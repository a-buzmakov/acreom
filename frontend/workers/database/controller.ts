import DexieDB from 'dexie';
import { v4 } from 'uuid';
import _isOnline from 'is-online';
import isEmpty from 'lodash/isEmpty';
import {
    createRawCompressedJSONDatagram,
    decryptSymmetric,
    encryptSymmetric,
    generatePublicPrivateKeyPair,
} from '@skiff-org/skiff-crypto';
import { fil } from 'date-fns/locale';
import { add, startOfDay } from 'date-fns';
import {
    DocumentsIndexedDB,
    ProjectsIndexedDB,
    UsersIndexedDB,
    VaultsIndexedDB,
} from './indexeddb';
import { acreomConfigIndexedDB } from './indexeddb/config';
import { ImagesIndexedDB } from './indexeddb/images';
import { LocalConfigIndexedDB } from './indexeddb/local-config';
import { IntegrationsIndexedDB } from './indexeddb/integrations';
import { EventsIndexedDB } from './indexeddb/events';
import { IUser, IVault, SessionData } from './indexeddb/types';
import {
    DatabaseEmitFn,
    DatabaseInvokeFn,
    IndexedDBBase,
} from './indexeddb/base';
import {
    acreomVaultIndexedDB,
    deleteVaultIndexedDB,
    registerVaultIndexedDB,
} from './indexeddb/connector';
import { MDParser } from './device/parser';
import { VersionsIndexedDB } from './indexeddb/versions';
import { IFolder, WatchEvent, WEntity } from '~/@types';
import { WorkerContext, CloudResponse } from '~/@types/app';
import { CloudService } from '~/workers/cloud/service';
import {
    AssistantActions,
    CloudServiceAction,
    LoadProgressState,
    ServiceKey,
    UtilActions,
} from '~/constants';
import { DeviceWatcher } from '~/workers/database/device';
import { DeviceWriter } from '~/workers/database/device/writer';
import { ImageDataIndexedDB } from '~/workers/database/indexeddb/imageData';
import { GoogleCalendarEventsIndexedDB } from '~/workers/database/indexeddb/google-calendar';
import { LocalConflictsIndexedDB } from '~/workers/database/indexeddb/localConflicts';
import { ConditionAtomicQueue } from '~/workers/database/device/queue';
import { IntegrationsDataIndexedDB } from '~/workers/database/indexeddb/integrationData';
import { AppSettingsIndexedDB } from '~/workers/database/indexeddb/appSettings';
import { FileImporter } from '~/workers/database/device/importer';
import { MDLoader } from '~/workers/database/device/importer/loader';
import {
    ImporterEvents,
    ProgressReporter,
} from '~/workers/database/reporter/interface';
import { DeviceReporter } from '~/workers/database/reporter';
import { StorageFactory } from '~/workers/database/device/importer/importer';
import { TasksIndexedDB } from '~/workers/database/indexeddb/tasks';
import { ViewsIndexedDB } from '~/workers/database/indexeddb/views';
import { MigrationsIndexedDB } from '~/workers/database/indexeddb/migrations';
import { SessionDataIndexedDB } from '~/workers/database/indexeddb/sessionData';
import { utf8BytesToString } from '~/workers/encryption/factory';
import { EncryptionReporter } from '~/workers/database/reporter/encryption';
import { RecoveryKeysIndexedDB } from '~/workers/database/indexeddb/recovery-keys';
import {
    propertiesFilter,
    shouldPrepareUsers,
} from '~/workers/assistant/chat/tools/filtering';
import { JiraIntegrationDataType } from '~/constants/jira';

export class OnDeviceService {
    private vaultsIndexedDB!: VaultsIndexedDB;
    private usersIndexedDB!: UsersIndexedDB;
    private appSettingsIndexedDB!: AppSettingsIndexedDB;
    private sessionDataIndexedDB!: SessionDataIndexedDB;
    private recoveryKeysIndexedDB!: RecoveryKeysIndexedDB;

    private projectsIndexedDB!: ProjectsIndexedDB;
    private documentsIndexedDB!: DocumentsIndexedDB;
    private eventsIndexedDB!: EventsIndexedDB;
    private localConfigIndexedDB!: LocalConfigIndexedDB;
    private tasksIndexedDB!: TasksIndexedDB;
    private migrationsIndexedDB!: MigrationsIndexedDB;
    private integrationsIndexedDB!: IntegrationsIndexedDB;
    private googleCalendarEventsIndexedDB!: GoogleCalendarEventsIndexedDB;
    private integrationsDataIndexedDB!: IntegrationsDataIndexedDB;
    private imagesIndexedDB!: ImagesIndexedDB;
    private imageDataIndexedDB!: ImageDataIndexedDB;
    private localConflictsIndexedDB!: LocalConflictsIndexedDB;
    private versionsIndexedDB!: VersionsIndexedDB;

    private watcher!: DeviceWatcher;
    private atomicQueue: ConditionAtomicQueue;
    public writer!: DeviceWriter<any>;
    public initialDBVersions!: Record<string, number>;

    private viewsIndexedDB!: ViewsIndexedDB;
    private _encryptionKeys: ReturnType<
        typeof generatePublicPrivateKeyPair
    > | null = null;

    private comms!: { emit: DatabaseEmitFn; invoke: DatabaseInvokeFn };

    private context!: WorkerContext & {
        $deviceService: OnDeviceService;
        $cloudService: CloudService;
    };

    private initialized: boolean = false;
    private isOnBackground: boolean = false;

    constructor(comms: { emit: DatabaseEmitFn; invoke: DatabaseInvokeFn }) {
        this.processWatchEvents = this.processWatchEvents.bind(this);
        this.comms = comms;
        this.atomicQueue = new ConditionAtomicQueue();
    }

    get Vaults(): VaultsIndexedDB {
        return this.vaultsIndexedDB;
    }

    get Documents(): DocumentsIndexedDB {
        return this.documentsIndexedDB;
    }

    get Events(): EventsIndexedDB {
        return this.eventsIndexedDB;
    }

    get Projects(): ProjectsIndexedDB {
        return this.projectsIndexedDB;
    }

    get LocalConfig(): LocalConfigIndexedDB {
        return this.localConfigIndexedDB;
    }

    get Tasks(): TasksIndexedDB {
        return this.tasksIndexedDB;
    }

    get Migrations(): MigrationsIndexedDB {
        return this.migrationsIndexedDB;
    }

    get Images(): ImagesIndexedDB {
        return this.imagesIndexedDB;
    }

    get ImageData(): ImageDataIndexedDB {
        return this.imageDataIndexedDB;
    }

    get LocalConflicts(): LocalConflictsIndexedDB {
        return this.localConflictsIndexedDB;
    }

    get Integrations(): IntegrationsIndexedDB {
        return this.integrationsIndexedDB;
    }

    get Users(): UsersIndexedDB {
        return this.usersIndexedDB;
    }

    get SessionData(): SessionDataIndexedDB {
        return this.sessionDataIndexedDB;
    }

    get GoogleCalendarEventsIndexedDB() {
        return this.googleCalendarEventsIndexedDB;
    }

    get IntegrationsDataIndexedDB() {
        return this.integrationsDataIndexedDB;
    }

    get configDatabase(): typeof acreomConfigIndexedDB {
        return acreomConfigIndexedDB;
    }

    get Views() {
        return this.viewsIndexedDB;
    }

    get AppSettings(): AppSettingsIndexedDB {
        return this.appSettingsIndexedDB;
    }

    get RecoveryKeys(): RecoveryKeysIndexedDB {
        return this.recoveryKeysIndexedDB;
    }

    get Versions(): VersionsIndexedDB {
        return this.versionsIndexedDB;
    }

    async vaultExists(vaultId?: string): Promise<boolean> {
        if (!vaultId) return false;
        const vault = await this.Vaults.retrieve('', vaultId).catch(() => null);
        return !!vault;
    }

    public isOnline = true;
    private onlineCheckInterval: any = null;

    async initialize(ctx: WorkerContext) {
        if (this.initialized) return;
        this.initialized = true;

        const versions =
            await acreomConfigIndexedDB.retrieveVaultDatabaseVersions();

        this.initialDBVersions = versions.reduce(
            (
                acc: Record<string, number>,
                db: { name: string; version: number },
            ) => ({
                ...acc,
                [db.name]: db.version,
            }),
            {} as Record<string, number>,
        );

        this.context = {
            ...ctx,
            ...this.comms,
            $deviceService: this,
        };
        this.context.$config.sep =
            this.context.$config.os === 'windows' ? '\\' : '/';

        this.registerNetworkHandlers();

        this.watcher = new DeviceWatcher(this.context);

        this.projectsIndexedDB = new ProjectsIndexedDB(this.context);
        this.documentsIndexedDB = new DocumentsIndexedDB(this.context);
        this.googleCalendarEventsIndexedDB = new GoogleCalendarEventsIndexedDB(
            this.context,
        );
        this.integrationsDataIndexedDB = new IntegrationsDataIndexedDB(
            this.context,
        );
        this.eventsIndexedDB = new EventsIndexedDB(this.context);
        this.localConfigIndexedDB = new LocalConfigIndexedDB(this.context);
        this.tasksIndexedDB = new TasksIndexedDB(this.context);
        this.imagesIndexedDB = new ImagesIndexedDB(this.context);
        this.imageDataIndexedDB = new ImageDataIndexedDB(this.context);
        this.localConflictsIndexedDB = new LocalConflictsIndexedDB(
            this.context,
        );
        this.migrationsIndexedDB = new MigrationsIndexedDB(this.context);
        this.vaultsIndexedDB = new VaultsIndexedDB(this.context);
        this.integrationsIndexedDB = new IntegrationsIndexedDB(this.context);
        this.usersIndexedDB = new UsersIndexedDB(this.context);
        this.sessionDataIndexedDB = new SessionDataIndexedDB(this.context);
        this.recoveryKeysIndexedDB = new RecoveryKeysIndexedDB(this.context);

        this.viewsIndexedDB = new ViewsIndexedDB(this.context);
        this.versionsIndexedDB = new VersionsIndexedDB(this.context);
        this.appSettingsIndexedDB = new AppSettingsIndexedDB(this.context);
    }

    async initializeAcreomConfigDB() {
        await acreomConfigIndexedDB.initialize(this.context);
        await this.checkEncryptionKeys();
        this.vaultsIndexedDB.registerVaultSync();
        const isEncryptionEnabled = await this.isEncryptionEnabledForUser();

        const vaults = await this.vaultsIndexedDB.list('');

        await Promise.all(
            vaults.map(async vault => {
                this.context.emit(ServiceKey.UTILS, UtilActions.INDEX_ENTITY, {
                    vaultId: vault.id,
                    type: 'vault',
                    entity: vault,
                });

                if (vault.type !== 'local' || !vault.filepath) return null;
                if (isEncryptionEnabled && vault.type !== 'local') {
                    return null;
                }
                await this.importLocalChanges(vault).catch(e => {
                    e.message =
                        `could not import changes from '${
                            vault.type
                        }' vault: hasFilepath: ${!!vault.filepath}: ` +
                        e.message;
                    this.context.emit(ServiceKey.SENTRY, 'trackError', e);
                });
                this.registerWatch(vault);
            }),
        );
    }

    async checkEncryptionKeys() {
        const dbUsers = await this.context.$deviceService.Users.list('');
        const dbUser = dbUsers.shift();
        if (!dbUser) return;
        const response = await this.context.invoke<CloudResponse<any>>(
            ServiceKey.CLOUD,
            CloudServiceAction.RETRIEVE,
            {
                entity: 'user',
                payload: {},
                callerContext: 'controller.ts/checkEncryptionKeys',
            },
        );
        if (!response.data || response?.status > 200) return;
        const user = response.data;
        if (!user) return;

        if (dbUser?.privateKeys !== user.privateKeys) {
            await this.context.$deviceService.SessionData.clear();
        }
    }

    public websocketsOnline = true;

    startNetworkCheck() {
        if (!this.isOnline) return;

        this.isOnline = false;
        this.context.emit(ServiceKey.STORE, 'dispatch:misc/isOnline', false);
        this.disconnectAllSync();
        this.isOnlineCheck();
    }

    registerNetworkHandlers() {
        this.context.on('network:offline', () => {
            this.startNetworkCheck();
        });
        this.context.on('network:online', () => {
            if (this.isOnBackground || this.isOnline) return;

            this.context.emit(ServiceKey.STORE, 'dispatch:misc/isOnline', true);
            this.isOnline = true;
            this.connectAllSync();
        });

        this.context.on('protocol:fetch-remote-data', async () => {
            const vaults = await this.Vaults.list('');
            const syncedVaults = vaults.filter(({ type }) => type === 'remote');
            const ids = ['acreom-config', ...syncedVaults.map(({ id }) => id)];
            ids.forEach(id => {
                this.handleEvent(`protocol:fetch-remote-data:${id}`);
            });
        });
        this.context.on('network:websockets:online', async () => {
            if (this.isOnBackground || this.websocketsOnline) return;

            this.websocketsOnline = true;
            this.isOnline = false;
            this.context.emit(
                ServiceKey.STORE,
                'dispatch:misc/isOnline',
                false,
            );
            await this.disconnectAllSync();
            this.isOnline = true;
            await this.connectAllSync();
        });
        this.context.on('network:websockets:offline', () => {
            if (!this.websocketsOnline) return;

            this.websocketsOnline = false;
        });
        this.context.on('device:pause', () => {
            this.isOnBackground = true;
            this.disconnectAllSync();
        });
        this.context.on('device:resume', () => {
            this.isOnBackground = false;
            this.connectAllSync();
        });
    }

    eventListeners: Record<string, ((...args: any[]) => void)[]> = {};

    on(event: string, cb: (payload: any) => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(cb);
    }

    off(event: string) {
        this.eventListeners[event] = [];
    }

    protected handleEvent(event: string, payload?: any) {
        this.eventListeners[event]?.forEach(cb => {
            cb(payload);
        });
    }

    isOnlineCheck() {
        if (
            this.onlineCheckInterval ||
            this.context.$config.platform === 'mobile'
        )
            return;

        this.onlineCheckInterval = setInterval(async () => {
            let isOnline = false;
            if (this.context.$config.platform === 'web') {
                isOnline = await this.context.invoke(
                    ServiceKey.DEVICE,
                    'network:isOnline',
                    null,
                );
            }
            if (this.context.$config.platform === 'desktop') {
                isOnline = await _isOnline();
            }
            if (!isOnline) return;

            clearInterval(this.onlineCheckInterval);
            this.isOnline = true;
            this.connectAllSync();
            this.onlineCheckInterval = null;
        }, 5000);
    }

    async initializeUser(credentials: {
        accessToken: string;
        refreshToken: string;
    }) {
        const response = await this.context.invoke<any>(
            ServiceKey.CLOUD,
            CloudServiceAction.RETRIEVE,

            {
                entity: 'user',
                payload: { id: credentials.accessToken },
                callerContext: 'controller.ts/initializeUser',
            },
        );

        if (response.status >= 400) {
            return null;
        }

        await acreomConfigIndexedDB.Users.put({
            ...response.data,
            credentials,
        });

        await this.context.invoke(
            ServiceKey.STORE,
            'dispatch:auth/initialize',
            {
                ...response.data,
                credentials,
                callerContext: 'controller.ts/initializeUser',
            },
        );
        return response.data;
    }

    async initializeSync() {
        await acreomConfigIndexedDB.connectSyncProtocol(this.context);
        await acreomConfigIndexedDB.waitForCloudSync();
        const users = await this.Users.list('');
        const user = users.shift();
        if (user?.privateKeys && !this._encryptionKeys) {
            // TODO: HANDLE PASSPHRASE HERE;
            this.context.emit(ServiceKey.NUXT, 'emit', {
                event: 'encryption:passphrase',
            });
            return;
        }
        await this.initializeVaultsSync();
    }

    async initializeVaultsSync() {
        const vaults = await this.Vaults.list('');
        const syncedVaults = vaults.filter(({ type }) => type === 'remote');
        await Promise.all(
            syncedVaults.map(async (vault: IVault) => {
                await acreomVaultIndexedDB(vault.id).initialize(this.context);
                acreomVaultIndexedDB(vault.id).createProtocolInstance();
                if (
                    this.context.$config.platform === 'desktop' &&
                    vault.filepath
                ) {
                    await this.importLocalChanges(vault).catch(e => {
                        e.message =
                            `could not import changes from '${
                                vault.type
                            }' vault: hasFilepath: ${!!vault.filepath}: ` +
                            e.message;
                        console.log(e);
                        this.context.emit(ServiceKey.SENTRY, 'trackError', e);
                    });
                }
                await acreomVaultIndexedDB(vault.id)
                    .registerSyncProtocol()
                    .catch(e => {
                        e.message =
                            `could not register protocol for '${
                                vault.type
                            }' vault: hasFilepath: ${!!vault.filepath}: ` +
                            e.message;
                        console.log(e);
                        this.context.emit(ServiceKey.SENTRY, 'trackError', e);
                    });
                await acreomVaultIndexedDB(vault.id)
                    .waitForCloudSync()
                    .catch(e => {
                        e.message =
                            `could not wait for sync on '${
                                vault.type
                            }' vault: hasFilepath: ${!!vault.filepath}: ` +
                            e.message;
                        console.log(e);
                        this.context.emit(ServiceKey.SENTRY, 'trackError', e);
                    });
            }),
        );
    }

    async getUser(): Promise<IUser | null> {
        const users = await this.Users.list('');
        return users.shift() ?? null;
    }

    get isEncryptionUnlocked() {
        return !isEmpty(this._encryptionKeys);
    }

    async initializeAvailableVaults(): Promise<void> {
        const user = await this.getUser();
        const vaults = await this.Vaults.list('');
        const localVaults = vaults.filter(({ type }) => type === 'local');
        const remoteVaults = vaults.filter(({ type }) => type === 'remote');

        await Promise.all(
            localVaults.map(vault =>
                registerVaultIndexedDB(vault, this.context).initialize(
                    this.context,
                ),
            ),
        );
        if (!user) {
            return;
        }

        const isEncryptionEnabled = await this.isEncryptionEnabledForUser();
        const isEncryptionUnlocked = this.isEncryptionUnlocked;

        if (isEncryptionEnabled && !isEncryptionUnlocked) {
            return;
        }

        await Promise.all(
            remoteVaults.map(vault =>
                registerVaultIndexedDB(vault, this.context).initialize(
                    this.context,
                ),
            ),
        );
    }

    connectAllSync(): Promise<void> {
        return new Promise<void>(resolve => {
            this.atomicQueue.execute({
                id: 'connect-sync',
                fn: () => this._connectAllSync().then(resolve),
            });
        });
    }

    async _connectAllSync() {
        const users = await this.Users.list('');
        if (!users.length) return;
        await acreomConfigIndexedDB.connectSyncProtocol(this.context);
        const user = users.shift();
        if (user?.privateKeys && !this._encryptionKeys) {
            // TODO: HANDLE PASSPHRASE HERE;
            return;
        }
        const vaults = await this.Vaults.list('');
        await Promise.all(
            vaults
                .filter(({ type }) => type === 'remote')
                .map(vault => {
                    return acreomVaultIndexedDB(vault.id).connectSync();
                }),
        );
    }

    removeFilepathFromEntities(vaultId: string) {
        return Promise.all([
            this.Documents.removeFilepaths(vaultId),
            this.Events.removeFilepaths(vaultId),
            this.Projects.removeFilepaths(vaultId),
            this.Images.removeFilepaths(vaultId),
        ]);
    }

    setBaseUrl(baseUrl: string, selfHostedSync = true) {
        if (!this.context?.$config) return;
        this.context.$config.baseUrl = baseUrl;
        this.context.$config.selfHostedSync = selfHostedSync;
    }

    connectVaultSync(vaultId: string) {
        return acreomVaultIndexedDB(vaultId).connectSync();
    }

    disconnectVaultSync(vaultId: string) {
        return acreomVaultIndexedDB(vaultId).disconnectSync(true);
    }

    disconnectAllSync(): Promise<void> {
        return new Promise<void>(resolve => {
            this.atomicQueue.execute({
                id: 'disconnect-sync',
                fn: () => this._disconnectAllSync().then(resolve),
            });
        });
    }

    async _disconnectAllSync() {
        const vaults = await this.Vaults.list('');
        await Promise.all([
            acreomConfigIndexedDB.disconnectSync(this.context),
            ...vaults
                .filter(({ type }) => type === 'remote')
                .map(vault => {
                    return acreomVaultIndexedDB(vault.id).disconnectSync();
                }),
        ]);
    }

    async importVault(vaultId: string) {
        const vault = await this.context.$deviceService.Vaults.retrieve(
            '',
            vaultId,
        );
        if (!vault) return;

        const reporter = new DeviceReporter(this.context, vaultId);
        this.registerProgressListeners(
            reporter,
            LoadProgressState.IMPORTING_NEW_VAULT,
        );
        const importer = this.createMDImporter(vault, reporter, {
            batchSize: 50,
        });
        await importer.importUsingFilepath(vault.filepath!, { copy: false });
    }

    async importUsingFilepaths(vaultId: string, filepaths: string[]) {
        const vault = await this.Vaults.retrieve('', vaultId);
        if (!vault) return;
        const reporter = new DeviceReporter(this.context, vaultId);
        this.registerProgressListeners(
            reporter,
            LoadProgressState.IMPORTING_NEW_CHANGES,
        );

        this.context.emit(ServiceKey.TOAST, 'message', {
            message: `Importing...`,
        });

        reporter.on(
            ImporterEvents.COMPLETE,
            ({
                total,
                data,
                unsupported,
            }: {
                total: number;
                unsupported: number;
                data: any;
            }) => {
                if (total === 0 && unsupported === 0) {
                    this.context.emit(ServiceKey.TOAST, 'message', {
                        message: `No files to import`,
                    });
                    return;
                }

                if (unsupported === 0) {
                    this.context.emit(ServiceKey.TOAST, 'message', {
                        message: `Imported ${total} files`,
                    });

                    return;
                }

                this.context.emit(ServiceKey.VFM, 'show', {
                    component: `UnsupportedFilesModal.vue`,
                    bind: {
                        total,
                        unsupported,
                        data,
                    },
                });
            },
        );

        const importer = this.createMDImporter(vault, reporter, {
            batchSize: 50,
        });
        await importer.importUsingMultipleFilepaths(filepaths, { copy: true });
    }

    async importLocalChanges(vault: IVault) {
        if (vault.type === 'local') {
            const { payload: exists } = await this.context.invoke<{
                payload: boolean;
            }>(ServiceKey.DEVICE, 'vault:exists', vault);
            if (!exists) {
                await this.context.$deviceService.deleteVault(vault);
                await this.context.$deviceService.Vaults.delete('', vault, {
                    writeToDevice: false,
                });
                return;
            }
        }
        if (!vault.filepath) return;

        const reporter = new DeviceReporter(this.context, vault.id);
        this.registerProgressListeners(
            reporter,
            LoadProgressState.IMPORTING_NEW_CHANGES,
        );
        const importer = this.createMDImporter(vault, reporter, {
            batchSize: 50,
        });
        await importer.importChanges(vault);
    }

    async registerConfigSyncProtocol() {
        await acreomConfigIndexedDB.registerSyncProtocol(this.context);
        await acreomConfigIndexedDB.connectSyncProtocol(this.context);
    }

    getActiveVault(): Promise<IVault | null> {
        return acreomConfigIndexedDB.getActiveVault();
    }

    setActiveVault(id: string) {
        acreomConfigIndexedDB.setActiveVault(id);
    }

    processWatchEvents(events: WatchEvent[]): Promise<void> {
        return this.watcher.processWatchEvents(events);
    }

    async mirrorVault(vault: IVault) {
        const newVault = await this.Vaults.save('', {
            ...vault,
            id: v4(),
            name: `${vault.name} copy`,
        });

        await new Promise(resolve => {
            setTimeout(() => {
                resolve({});
            }, 1000);
        });

        const syncData = async (idb: IndexedDBBase<any>) => {
            const data = await idb.list(vault.id);
            do {
                const batch = data.splice(0, 50);
                await Promise.all(
                    batch.map(b =>
                        idb.save(newVault.id!, {
                            ...b,
                            id: v4(),

                            vaultId: newVault.id,
                        }),
                    ),
                );
            } while (data.length > 0);
        };

        await syncData(this.Projects);
        await syncData(this.Events);
        await syncData(this.Integrations);
        await syncData(this.Documents);
        await syncData(this.Images);
    }

    async syncContentToDevice(
        vault: IVault,
        _options: Record<string, any> = {},
    ) {
        // toast start sync to device

        const progressReporter = new DeviceReporter(this.context, vault.id);
        progressReporter.on(ImporterEvents.COMPLETE, data => {
            if (data.total <= 0) return;
            this.context.emit(ServiceKey.TOAST, 'message', {
                message: `Synced ${data.total} items to device`,
            });
        });
        progressReporter.start();
        await this.Projects.syncAllToDevice(
            vault,
            { extension: '' },
            progressReporter,
        ).catch(e => console.log(e));
        await this.Images.syncAllToDevice(vault, {}, progressReporter).catch(
            e => console.log(e),
        );
        await this.Documents.syncAllToDevice(vault, {}, progressReporter).catch(
            e => console.log(e),
        );

        progressReporter.done();
    }

    async acceptLocalChanges(vaultId: string, changes: WEntity[]) {
        const groups = changes.reduce((acc, change) => {
            if (!acc[change.kind!]) {
                acc[change.kind!] = [];
            }
            acc[change.kind!].push(change);
            return acc;
        }, {} as Record<string, WEntity[]>);

        for (const group of Object.keys(groups)) {
            switch (group) {
                case 'document':
                    await this.Documents.deleteBulk(vaultId, groups[group]);
                    break;
                case 'event':
                    await this.Events.deleteBulk(vaultId, groups[group]);
                    break;
                case 'folder':
                    await this.Projects.deleteBulk(vaultId, groups[group]);
            }
        }
        await this.LocalConflicts.deleteBulk(vaultId, changes);
    }

    async acceptRemoteChanges(
        vaultId: string,
        changes: ((WEntity | IFolder) & { kind: string })[],
    ) {
        const groups = changes.reduce((acc, change) => {
            if (!acc[change.kind!]) {
                acc[change.kind!] = [];
            }
            acc[change.kind!].push(change);
            return acc;
        }, {} as Record<string, (WEntity | IFolder)[]>);
        const vault = await this.Vaults.retrieve('', vaultId);
        if (!vault) return;
        if (groups?.folder?.length) {
            await this.writer.createFoldersBatch(groups.folder as IFolder[]);
        }
        for (const group of Object.keys(groups)) {
            switch (group) {
                case 'document':
                    await this.writer.syncEntity(vault, this.Documents, e =>
                        groups[group].some(c => c.id === e.id),
                    );
                    break;
                case 'event':
                    await this.writer.syncEntity(vault, this.Events, e =>
                        groups[group].some(c => c.id === e.id),
                    );
                    break;
            }
        }
        await this.LocalConflicts.deleteBulk(vaultId, changes);
    }

    registerWatch(vault: IVault) {
        const indexedDB = acreomVaultIndexedDB(vault.id);
        return indexedDB.registerWatch(vault);
    }

    disconnectWatch(vault: IVault) {
        const indexedDB = acreomVaultIndexedDB(vault.id);
        return indexedDB.disconnectWatch(vault);
    }

    registerSyncProtocol(vault: IVault) {
        const indexedDB = acreomVaultIndexedDB(vault.id);
        indexedDB.registerSyncProtocol({ isInitialSync: true });
    }

    async disconnectSync(
        vault: Partial<IVault> | { id: string | null },
        shouldDelete = false,
    ) {
        if (!vault.id) {
            await acreomConfigIndexedDB.disconnectSync(this.context);
            return;
        }
        const indexedDB = acreomVaultIndexedDB(vault.id);
        await indexedDB.disconnectSync(shouldDelete);
    }

    async deleteVault(vault: IVault) {
        const indexedDB = acreomVaultIndexedDB(vault.id);
        if (!indexedDB) return;
        const deleteIndexedDB = async (indexedDB: any) => {
            const syncables = await indexedDB.syncable.list();
            await Promise.all(
                syncables.map((syncable: any) => {
                    return indexedDB.syncable.disconnect(syncable);
                }),
            );
        };

        if (vault.type === 'remote') {
            await deleteIndexedDB(indexedDB);
            await this.context.invoke(
                ServiceKey.CLOUD,
                CloudServiceAction.DELETE,
                {
                    entity: 'vault',
                    payload: vault,
                    callerContext: 'controller.ts/deleteVault',
                },
            );
        }

        await deleteVaultIndexedDB(indexedDB.name);
        const vaultExists = await acreomConfigIndexedDB.Vaults.get(
            indexedDB.name,
        );
        if (!vaultExists) return;
        await this.context.invoke(
            ServiceKey.STORE,
            'dispatch:vault/delete',
            indexedDB.name,
        );
    }

    async logout() {
        const deleteConfigDatabaseSync = async () => {
            const originList = await this.configDatabase.syncable.list();
            await Promise.all(
                originList.map(async sync => {
                    await this.configDatabase.syncable.delete(sync);
                }),
            );
            await this.configDatabase._syncNodes
                .filter(({ type }) => type === 'remote')
                .delete();
        };

        const deleteSyncedVaults = async () => {
            const vaults = await this.Vaults.list('');
            const remoteVaults = vaults.filter(({ type }) => type === 'remote');

            await Promise.all(
                remoteVaults.map(vault => {
                    const indexedDB = acreomVaultIndexedDB(vault.id);
                    return deleteIndexedDB(indexedDB);
                }),
            );

            this.configDatabase.table('_changes').clear();

            await this.context.invoke(
                ServiceKey.STORE,
                'dispatch:vault/indexedDBDelete',
                remoteVaults.map(({ id }) => id),
            );
        };

        const deleteUsers = async () => {
            await this.configDatabase.Users.clear();
            await this.configDatabase.RecoveryKeys.clear();
            await this.configDatabase.SessionData.clear();
        };

        const deleteIndexedDB = async (_indexedDB: DexieDB): Promise<void> => {
            const syncables = await _indexedDB.syncable.list();
            await Promise.all(
                syncables.map(async syncable => {
                    await _indexedDB.syncable.delete(syncable);
                }),
            );
            _indexedDB.on('blocked', () => {
                _indexedDB.delete();
            });
            await _indexedDB.delete();
            await this.Vaults.delete('', {
                id: _indexedDB.name,
            });
            await deleteVaultIndexedDB(_indexedDB.name);
        };

        this.context.emit(ServiceKey.CLOUD, CloudServiceAction.CLEAR_CACHE, {});
        this._encryptionKeys = null;
        await deleteConfigDatabaseSync();
        await deleteUsers();
        await deleteSyncedVaults();
        await this.configDatabase.table('_changes').clear();
    }

    createMDImporter(
        vault: IVault,
        reporter: DeviceReporter,
        config: Partial<FileImporter['config']>,
    ): FileImporter {
        return new FileImporter(
            vault,
            this.context,
            new MDLoader(this.context),
            new MDParser(this.context),
            this.dbResolver(),
            reporter,
            config,
        );
    }

    dbResolver(): StorageFactory {
        return {
            resolve: (type: string) => {
                switch (type) {
                    case 'document':
                        return this.context.$deviceService.Documents;
                    case 'event':
                        return this.context.$deviceService.Events;
                    case 'project':
                    case 'folder':
                        return this.context.$deviceService.Projects;
                    default:
                        throw new Error(`Unknown type ${type}`);
                }
            },
        };
    }

    registerProgressListeners(
        reporter: ProgressReporter,
        progressState: LoadProgressState,
    ) {
        reporter.on(ImporterEvents.PROGRESS, data => {
            const vaultId = data.vaultId;
            delete data.vaultId;

            this.context.emit(
                ServiceKey.STORE,
                'dispatch:vault/setVaultStatus',
                {
                    vaultId,
                    deviceStatus: {
                        state: progressState,
                        info: data,
                    },
                },
            );
        });
        reporter.on(ImporterEvents.COMPLETE, data => {
            const vaultId = data.vaultId;
            delete data.vaultId;

            this.context.emit(
                ServiceKey.STORE,
                'dispatch:vault/setVaultStatus',
                {
                    vaultId,
                    deviceStatus: {
                        state: LoadProgressState.OKAY,
                        info: data,
                    },
                },
            );
        });
    }

    async isVaultConnected(vaultId: string) {
        const vault = await this.Vaults.retrieve('', vaultId);
        if (!vault) return false;
        if (vault.type === 'local') return true;
        const status = await acreomVaultIndexedDB(vault.id).getSyncStatus();
        return [2, 3].includes(status);
    }

    async connectedVaults() {
        const vaults = await this.Vaults.list('');
        const localVaults = vaults.filter(({ type }) => type === 'local');
        const remoteVaults = vaults.filter(({ type }) => type === 'remote');
        const vaultStatuses = await Promise.all(
            remoteVaults.map(vault => {
                return acreomVaultIndexedDB(vault.id).getSyncStatus();
            }),
        );

        return [
            ...localVaults,
            ...remoteVaults.filter((_, i) => [2, 3].includes(vaultStatuses[i])),
        ];
    }

    get encryptionKeys() {
        return this._encryptionKeys;
    }

    get isEncryptionEnabled() {
        return !!this._encryptionKeys;
    }

    async unlockPrivateKeys(hkdf: string, _userId: string) {
        const user = await this.getUser();
        if (!user) return true;
        try {
            this._encryptionKeys = this.decryptUserPrivateKeys(
                user.privateKeys,
                hkdf,
            );

            return true;
        } catch (e) {
            console.log("couldn't unlock user encryption keys", e);
            return false;
        }
    }

    async isEncryptionEnabledForUser() {
        const users = await this.Users.list('');
        const user = users.shift();
        if (!user) return false;
        return !!user.privateKeys;
    }

    didRestoreSessionKey(): boolean {
        return !!this._encryptionKeys;
    }

    async restoreSessionKey(decodedData: Uint8Array, userId: string) {
        const cryptoKeys = await this.SessionData.list('');
        const sessionKey = cryptoKeys.find(
            (key: SessionData) => key.id === userId,
        )?.sessionKey as any;
        if (!sessionKey || isEmpty(sessionKey)) return false;

        if (this.context.$config.platform === 'desktop') {
            // TODO: handle electron session key recovery
        }

        const decryptedHkdf = await crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP',
            },
            sessionKey.privateKey,
            decodedData,
        );
        const hkdf = utf8BytesToString(new Uint8Array(decryptedHkdf));
        return this.unlockPrivateKeys(hkdf, userId);
    }

    decryptUserPrivateKeys(
        privateKeys: string,
        hkdf: string,
    ): ReturnType<typeof generatePublicPrivateKeyPair> {
        return decryptSymmetric(
            privateKeys,
            hkdf,
            createRawCompressedJSONDatagram<
                ReturnType<typeof generatePublicPrivateKeyPair>
            >('userPrivateKeys'),
        );
    }

    createRecoveryKey() {
        if (!this.encryptionKeys) return null;
        return this.RecoveryKeys.createRecoveryKey(this.encryptionKeys);
    }

    async decryptAndVerifyRecoveryKey(
        id: string,
        recoveryKey: string,
    ): Promise<{ isValid: boolean; keys: any }> {
        const recoveryKeys = await this.RecoveryKeys.list('');
        const storedRecoveryKey = recoveryKeys.find(rk => rk.id === id);
        if (!storedRecoveryKey)
            return {
                isValid: false,
                keys: null,
            };
        return this.RecoveryKeys.decryptAndVerifyRecovery(
            storedRecoveryKey.encryptedData,
            recoveryKey,
        );
    }

    async recoverAccount(
        userId: string,
        id: string,
        recoveryKey: string,
        hkdf: string,
        hkdfSalt: string,
        passphraseSalt: string,
    ) {
        const { isValid, keys } = await this.decryptAndVerifyRecoveryKey(
            id,
            recoveryKey,
        );
        if (!isValid) return null;
        const UserPrivateKeysDatagram =
            createRawCompressedJSONDatagram<any>('userPrivateKeys');
        const encryptedKeys = encryptSymmetric(
            keys,
            hkdf,
            UserPrivateKeysDatagram,
        );

        await this.Users.save('', {
            id: userId,
            privateKeys: encryptedKeys,
            hkdfSalt,
            passphraseSalt,
        });
    }

    async encryptAllRemoteVaults() {
        let vaults = await this.Vaults.list(
            '',
            undefined,
            e => e.type === 'remote',
        );
        const activeVault = await this.getActiveVault();
        if (activeVault?.type === 'remote') {
            vaults = [
                vaults.find(v => v.id === activeVault.id) as IVault,
                ...vaults.filter(v => v.id !== activeVault.id),
            ];
        }

        for (const vault of vaults) {
            const reporter = new EncryptionReporter(this.context, vault.id);
            this.registerProgressListeners(
                reporter,
                LoadProgressState.ENCRYPTING_VAULT,
            );
            reporter.start();
            await this.encryptVault(vault.id, reporter);
            reporter.done();
        }
    }

    async encryptVault(vaultId: string, reporter?: ProgressReporter) {
        const tables = [
            this.documentsIndexedDB,
            this.projectsIndexedDB,
            this.imagesIndexedDB,
            this.integrationsIndexedDB,
        ];
        for (const table of tables) {
            await table.encryptAllContent(vaultId, reporter);
        }
    }

    async indexAssistantEmbeddings(vaultId: string): Promise<void> {}

    async getRelevantContent(vaultId: string, propertiesMatch: any) {
        const output: any[] = [];
        let userData = {};
        if (shouldPrepareUsers(propertiesMatch)) {
            userData = await this.getMyselfFromIntegrations(vaultId);
        }

        const docsGenerator = this.Documents.listPaginated(vaultId, null);
        for await (const docs of docsGenerator) {
            const validDocs = propertiesFilter(
                docs.map(doc => ({ ...doc, dbTableName: 'documents' })),
                propertiesMatch,
                userData,
            );
            if (!validDocs.length) continue;
            output.push(validDocs);
        }
        const integrationDataGenerator =
            this.IntegrationsDataIndexedDB.listPaginated(vaultId, null);
        for await (const integrationData of integrationDataGenerator) {
            const validData = propertiesFilter(
                integrationData.map(data => ({
                    ...data,
                    dbTableName: 'integrationData',
                })),
                propertiesMatch,
                userData,
            );
            if (!validData.length) continue;
            output.push(validData);
        }

        return output.flat();
    }

    async getMyselfFromIntegrations(vaultId: string) {
        const integrations = await this.Integrations.list(vaultId);
        const githubIntegration = integrations.find(
            integration => integration.type === 'github',
        );
        const jiraIntegration = integrations.find(
            integration => integration.type === 'jira',
        );
        const output: Record<string, any> = {};
        if (githubIntegration) {
            output.github = githubIntegration?.data?.account;
        }
        if (jiraIntegration) {
            const cloudId = jiraIntegration.data?.clouds?.[0]?.id;
            const userPrefix = `${JiraIntegrationDataType.MYSELF}/${cloudId}/`;
            const jiraMyself = await this.IntegrationsDataIndexedDB.table(
                vaultId,
            )
                .filter(
                    e =>
                        e.id.startsWith(userPrefix) &&
                        e.id.length > userPrefix.length,
                )
                .first();
            if (jiraMyself) {
                output.jira = jiraMyself;
            }
        }

        return output;
    }

    decryptIntegration(integration: any) {
        return this.Integrations.encryption.decryptData(integration.vaultId, [
            integration,
        ]);
    }
}
