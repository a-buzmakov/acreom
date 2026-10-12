import { WorkerContext } from '~/@types/app';
import { OnDeviceService } from '~/workers/database/controller';
import { DatabaseServiceAction, GenericActions, ServiceKey } from '~/constants';
import { IndexedDBBase } from '~/workers/database/indexeddb/base';
import { WorkerBase } from '~/workers/base';

export class DatabaseWorker extends WorkerBase {
    private deviceService: OnDeviceService;
    protected invokeTimeout: number = 60_000;
    protected serviceKey = ServiceKey.DATABASE;

    constructor() {
        super();
        const comms = this.getCommsFunctions();
        this.deviceService = new OnDeviceService(comms);
    }

    protected async handleMessage(
        operation: string,
        payload: any,
        messageId: string,
        service?: ServiceKey,
    ) {
        if (operation === DatabaseServiceAction.EMIT) {
            this.handleEvent(payload.event, payload.payload);
            this.emit(
                service || ServiceKey.DATABASE,
                GenericActions.RESPONSE,
                {},
                messageId,
            );
            return;
        }
        if (operation === GenericActions.RESPONSE) {
            this.invokeCallbacks[messageId]?.(payload);
            return;
        }
        const { table, payload: _payload } = payload;
        const response = await this.handleDatabaseQuery(
            table,
            operation,
            _payload,
        );
        this.emit(
            service || ServiceKey.DATABASE,
            GenericActions.RESPONSE,
            response ?? {},
            messageId,
        );
    }

    resolveService(table: string): IndexedDBBase<any> | null {
        switch (table) {
            case 'documents':
                return this.deviceService.Documents;
            case 'events':
                return this.deviceService.Events;
            case 'integrations':
                return this.deviceService.Integrations;
            case 'vaults':
                return this.deviceService.Vaults;
            case 'users':
                return this.deviceService.Users;
            case 'projects':
                return this.deviceService.Projects;
            case 'localConfig':
                return this.deviceService.LocalConfig;
            case 'images':
                return this.deviceService.Images;
            case 'imageData':
                return this.deviceService.ImageData;
            case 'googleCalendarEvents':
                return this.deviceService.GoogleCalendarEventsIndexedDB;
            case 'integrationsData':
            case 'integrationData':
                return this.deviceService.IntegrationsDataIndexedDB;
            case 'localConflicts':
            case '_localConflicts':
                return this.deviceService.LocalConflicts;
            case 'views':
                return this.deviceService.Views;
            case 'sessionData':
            case '_sessionData':
                return this.deviceService.SessionData;
            case 'recoveryKeys':
                return this.deviceService.RecoveryKeys;
            case 'versions':
                return this.deviceService.Versions;
            case 'appSettings':
                return this.deviceService.AppSettings;
            case 'tasks':
                return this.deviceService.Tasks;
            default:
                console.warn(
                    `[DatabaseWorker] resolveService ${table} not found`,
                );
                return null;
        }
    }

    private async handleDatabaseQuery(
        table: string,
        operation: string,
        payload: any,
    ): Promise<any> {
        let response: any = {};
        switch (operation) {
            case DatabaseServiceAction.GET_USER:
                response = await this.deviceService.getUser();
                return response;
            case DatabaseServiceAction.CONNECT_SYNC:
                this.deviceService.connectAllSync();
                return response;
            case DatabaseServiceAction.INITIALIZE_CONFIG_DATABASE:
                await this.deviceService.initializeAcreomConfigDB();
                return response;
            case DatabaseServiceAction.INITIALIZE_AVAILABE_VAULTS:
                this.deviceService.initializeAvailableVaults();
                return response;
            case DatabaseServiceAction.INITIALIZE_SYNC:
                this.deviceService.initializeSync();
                return response;
            case DatabaseServiceAction.INITIALIZE_VAULTS_SYNC:
                this.deviceService.initializeVaultsSync();
                return response;
            case DatabaseServiceAction.DISCONNECT_SYNC:
                this.deviceService.disconnectAllSync();
                return response;
            case DatabaseServiceAction.MIRROR_VAULT:
                this.deviceService.mirrorVault(payload.vault);
                return response;
            case DatabaseServiceAction.GET_IMAGE_AVAILABLE_PATH:
                response = await this.deviceService.Images.getAvailableFilepath(
                    payload.filepathBase,
                    undefined,
                    new Set(),
                    payload.ext,
                );
                return response;
            case DatabaseServiceAction.CONVERT_TO_MD:
                response = await this.deviceService.writer.convertToMD(
                    payload.vaultId,
                    payload.contents,
                );
                return response;
            case DatabaseServiceAction.IMPORT_MARKDOWN:
                response = await this.deviceService.importUsingFilepaths(
                    payload.vaultId,
                    payload.filepaths,
                );
                return response;
            case DatabaseServiceAction.REGISTER_CONFIG_SYNC_PROTOCOL:
                await this.deviceService.registerConfigSyncProtocol();
                return response;
            case DatabaseServiceAction.LOGOUT:
                await this.deviceService.logout();
                return response;
            case DatabaseServiceAction.DELETE_VAULT:
                await this.deviceService.deleteVault(payload);
                return response;
            case DatabaseServiceAction.LOAD_NEW_VAULT:
                if (payload.type === 'folder') return response;
                await this.deviceService.importVault(payload.vaultId);
                // await this.deviceService.loadNewVault(payload);
                return response;
            case DatabaseServiceAction.REGISTER_NEW_VAULT:
                return response;
            case DatabaseServiceAction.INITIALIZE:
                await this.deviceService.initialize(payload as WorkerContext);
                return response;
            case DatabaseServiceAction.SET_BASE_URL:
                this.deviceService.setBaseUrl(
                    payload.baseUrl,
                    payload.selfHostedSync ?? true,
                );
                return response;
            case DatabaseServiceAction.INITIALIZE_USER:
                response = await this.deviceService.initializeUser(payload);
                return response;
            case DatabaseServiceAction.GET_ACTIVE_VAULT:
                response = await this.deviceService.getActiveVault();
                return response;
            case DatabaseServiceAction.SET_ACTIVE_VAULT:
                await this.deviceService.setActiveVault(payload.id);
                return response;
            case DatabaseServiceAction.FILE_WATCHER_BATCH:
                await this.deviceService.processWatchEvents(payload.events);
                return response;
            case DatabaseServiceAction.SYNC_CONTENT_TO_DEVICE:
                await this.deviceService.syncContentToDevice(payload.vault);
                await this.deviceService.registerWatch(payload.vault);
                return response;
            case DatabaseServiceAction.REMOVE_FILEPATH_FROM_ENTITIES:
                this.deviceService.removeFilepathFromEntities(payload.vaultId);
                return response;
            case DatabaseServiceAction.REGISTER_SYNC_PROTOCOL:
                await this.deviceService.connectVaultSync(payload.vaultId);
                return response;
            case DatabaseServiceAction.UNREGISTER_SYNC_PROTOCOL:
                await this.deviceService.disconnectVaultSync(payload.vaultId);
                return response;
            case DatabaseServiceAction.ACCEPT_LOCAL_CHANGES:
                await this.deviceService.acceptLocalChanges(
                    payload.vaultId,
                    payload.changes,
                );
                return response;
            case DatabaseServiceAction.ACCEPT_REMOTE_CHANGES:
                await this.deviceService.acceptRemoteChanges(
                    payload.vaultId,
                    payload.changes,
                );
                return response;
            case DatabaseServiceAction.RESTORE_SESSION_KEY:
                response = await this.deviceService.restoreSessionKey(
                    payload.data,
                    payload.userId,
                );
                return response;
            case DatabaseServiceAction.DID_RESTORE_SESSION_KEY:
                response = await this.deviceService.didRestoreSessionKey();
                return response;
            case DatabaseServiceAction.UNLOCK_PRIVATE_KEYS:
                response = await this.deviceService.unlockPrivateKeys(
                    payload.data,
                    payload.userId,
                );
                return response;
            case DatabaseServiceAction.ENABLE_ENCRYPTION_ON_VAULT:
                await this.deviceService.encryptVault(payload.vaultId);
                return response;
            case DatabaseServiceAction.ENABLE_ENCRYPTION:
                await this.deviceService.encryptAllRemoteVaults();
                return response;
            case DatabaseServiceAction.RETRIEVE_DECRYPTED_IMAGE:
                response =
                    await this.deviceService.ImageData.retrieveDecryptedImage(
                        payload.vaultId,
                        payload.entity,
                    );
                return response;
            case DatabaseServiceAction.CREATE_RECOVERY_KEY:
                response = await this.deviceService.createRecoveryKey();
                return response;
            case DatabaseServiceAction.GET_PRIVATE_KEYS_FROM_RECOVERY:
                response = await this.deviceService.decryptAndVerifyRecoveryKey(
                    payload.id,
                    payload.recoveryKey,
                );
                return response;
            case DatabaseServiceAction.REINDEX_ASSISTANT_EMBEDDINGS:
                this.deviceService.indexAssistantEmbeddings(payload.vaultId);
                return response;
            case DatabaseServiceAction.CONNECTED_VAULTS:
                response = await this.deviceService.connectedVaults();
                return response;
            case DatabaseServiceAction.IS_VAULT_CONNECTED:
                response = await this.deviceService.isVaultConnected(
                    payload.vaultId,
                );
                return response;
            case DatabaseServiceAction.GET_RELEVANT_CONTENT:
                response = await this.deviceService.getRelevantContent(
                    payload.vaultId,
                    payload.propertiesMatch,
                );
                return response;
            case DatabaseServiceAction.GET_INTEGRATIONS_MYSELF:
                response = await this.deviceService.getMyselfFromIntegrations(
                    payload.vaultId,
                );
                return response;
            case DatabaseServiceAction.DECRYPT_INTEGRATION:
                response = await this.deviceService.decryptIntegration(
                    payload.data,
                );
                return response;
            case DatabaseServiceAction.ARCHIVE:
                await this.deviceService.Projects.archive(
                    payload.vaultId,
                    payload.entity,
                    payload.meta,
                );
                break;
        }
        const service = this.resolveService(table);
        if (!service) {
            return response;
        }
        switch (operation) {
            case DatabaseServiceAction.RETRIEVE:
                response = await service.retrieve(payload.vaultId, payload.id);
                break;
            case DatabaseServiceAction.LIST:
                response = [];
                response = await service.list(
                    payload?.vaultId,
                    payload?.query,
                    payload?.filter,
                    payload?.paginationId,
                );
                break;
            case DatabaseServiceAction.LIST_BY_QUERY:
                response = await service.listByQuery(
                    payload?.vaultId,
                    payload?.query,
                );
                break;
            case DatabaseServiceAction.LIST_BY_IDS:
                response = await service.listByIds(
                    payload?.vaultId,
                    payload?.ids,
                );
                break;
            case DatabaseServiceAction.SAVE:
                response = await service.save(
                    payload.vaultId,
                    payload.entity,
                    payload.meta,
                );
                break;
            case DatabaseServiceAction.SAVE_BULK:
                response = await service.saveBulk(
                    payload.vaultId,
                    payload.entity,
                    payload.meta,
                );
                break;
            case DatabaseServiceAction.DELETE_BULK:
                response = await service.deleteBulk(
                    payload.vaultId,
                    payload.entity,
                    payload.meta,
                );
                break;
            case DatabaseServiceAction.DELETE:
                response = await service.delete(
                    payload.vaultId,
                    payload.entity,
                    payload.meta,
                );
                break;
            case DatabaseServiceAction.DELETE_BATCH:
                await service.deleteByQuery(
                    payload.vaultId,
                    payload.query,
                    payload.meta,
                );
                break;
        }
        return response;
    }
}
