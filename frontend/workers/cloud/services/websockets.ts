import { Manager, Socket } from 'socket.io-client';
import {
    DatabaseServiceAction,
    GoogleCalendarIntegrationAction,
    JiraIntegrationAction,
    ServiceKey,
} from '~/constants';
import { WorkerContext } from '~/@types/app';
import { IUser } from '~/workers/database/indexeddb/types';

export class WebsocketsService {
    private context: WorkerContext;
    private manager!: Manager;
    private sockets: Record<string, Socket> = {};
    private isReady: boolean = false;
    private isReadyPromise: Promise<void> = Promise.resolve();
    private reconnecting: boolean = false;
    private isReadyPromiseCallback = () => {};

    constructor(ctx: WorkerContext) {
        this.context = ctx;
        this.isReadyPromise = new Promise<void>(resolve => {
            this.isReadyPromiseCallback = () => {
                this.isReady = true;
                resolve();
            };
        });
    }

    disconnectSockets() {
        for (const key of Object.keys(this.sockets)) {
            const tmpKey = key || '/acreom-config';
            const socket = this.sockets[tmpKey];
            if (!socket.disconnected) {
                try {
                    socket.off('connect_error');
                    socket.off('disconnect');
                    socket.io.off('error');
                    socket.disconnect();
                } catch (e) {}
            }
            delete this.sockets[tmpKey];
        }
    }

    resetForBaseUrlChange() {
        this.disconnectSockets();
        if (this.manager) {
            try {
                this.manager.removeAllListeners();
                // @ts-ignore socket.io Manager close
                this.manager.close?.();
            } catch (e) {}
            this.manager = undefined as any;
        }
        this.isReady = false;
        this.isReadyPromise = new Promise<void>(resolve => {
            this.isReadyPromiseCallback = () => {
                this.isReady = true;
                resolve();
            };
        });
    }

    async reconnectSockets() {
        if (this.reconnecting) return;
        this.reconnecting = true;
        const namespaces = Object.keys(this.sockets).reduce(
            (acc, key) => {
                if (!key.startsWith('/vault-')) return acc;
                const vaultId = key.split('/vault-').pop()!;
                return [...acc, vaultId];
            },
            // null represents acreom-config connection
            [null] as (string | null)[],
        );
        this.disconnectSockets();
        await Promise.all(
            namespaces.map(vaultId => this.registerProtocol(vaultId)),
        ).catch(e => console.log(e));
        this.reconnecting = false;
    }

    async initialize() {
        if (!this.manager) {
            this.manager = new Manager(
                this.context.$config.baseUrl
                    .replace('https', 'wss')
                    .replace('http', 'ws'),
                {
                    query: {
                        version: 'v2',
                    },
                    transports: ['websocket', 'polling'],
                    reconnectionDelay: 2000,
                    reconnection: true,
                    reconnectionDelayMax: 5000,
                    randomizationFactor: 1000,
                    reconnectionAttempts: 1000,
                    timeout: 5000,
                    autoConnect: true,
                },
            );
        }
        this.manager.on('error', async _err => {
            this.emitOffline();
            if (this.context.$config.platform === 'mobile') {
                const isOnBackground = await this.context.invoke(
                    ServiceKey.STORE,
                    'getters:misc/isOnBackground',
                    null,
                );
                if (isOnBackground) {
                    this.disconnectSockets();
                    return;
                }
            }
            setTimeout(() => {
                this.reconnectSockets();
            }, 3000);
        });
        this.isReadyPromiseCallback();
        if (!this.sockets['acreom-config']) {
            await this.registerProtocol(null);
        }
        this.manager.open();
    }

    private disconnectSocket(namespace: string) {
        if (!this.isReady) {
            return;
        }
        this.sockets[namespace].off('connect_error');
        this.sockets[namespace].off('disconnect');
        this.sockets[namespace].io.off('error');
        if (!this.sockets[namespace].disconnected) {
            this.sockets[namespace].disconnect();
        }
        delete this.sockets[namespace];
    }

    private registerEventListeners(vaultId: string, namespace: string) {
        this.sockets[namespace].onAny((event, data) => {
            switch (event) {
                case 'google-calendar-watch':
                    return this.context.emit(
                        ServiceKey.INTEGRATIONS,
                        GoogleCalendarIntegrationAction.WATCH_EMIT,
                        { ...JSON.parse(data), vaultId },
                    );
                case 'jira-integration-watch':
                    return this.context.emit(
                        ServiceKey.INTEGRATIONS,
                        JiraIntegrationAction.WATCH_EMIT,
                        { ...JSON.parse(data), vaultId },
                    );
                default:
                    this.context.emit(
                        ServiceKey.DATABASE,
                        DatabaseServiceAction.EMIT,
                        {
                            event: `${vaultId}-${event}`,
                            payload: JSON.parse(data),
                        },
                    );
            }
        });
    }

    private refetchData(vaultId: string) {
        const event = `protocol:fetch-remote-data:${vaultId}`;
        this.context.emit(ServiceKey.DATABASE, DatabaseServiceAction.EMIT, {
            event,
        });
    }

    private async connectSocket(
        namespace: string,
        vaultId: string,
        registerHandlers = false,
    ) {
        if (this.sockets[namespace]?.connected) {
            return Promise.resolve();
        }
        if (!this.isReady) {
            await this.isReadyPromise;
        }

        const authOptions = await this.authOptions();
        this.sockets[namespace] = this.manager.socket(namespace, authOptions);

        await new Promise<void>((resolve, reject) => {
            if (
                !this.sockets[namespace] ||
                this.sockets[namespace]?.connected
            ) {
                resolve();
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('socket connection timeout'));
            }, 30 * 1000);

            this.registerEventListeners(vaultId, namespace);
            this.sockets[namespace].once('connect', () => {
                if (registerHandlers) {
                    this.emitOnline();
                }
                if (registerHandlers) {
                    this.registerOfflineHandlers(namespace, vaultId);
                }
                this.refetchData(vaultId);
                clearTimeout(timeout);
                resolve();
            });

            this.sockets[namespace].connect();
        });
    }

    retryConnection(namespace: string) {
        const socket = this.sockets[namespace];
        if (!socket.disconnected) {
            this.sockets[namespace].disconnect();
        }

        setTimeout(() => {
            this.sockets[namespace].connect();
        }, 5000);
    }

    emitOnline() {
        this.context.emit(ServiceKey.DATABASE, DatabaseServiceAction.EMIT, {
            event: 'network:online',
        });
        this.context.emit(ServiceKey.DATABASE, DatabaseServiceAction.EMIT, {
            event: 'network:websockets:online',
        });
    }

    emitOffline() {
        this.context.emit(ServiceKey.DATABASE, DatabaseServiceAction.EMIT, {
            event: 'network:websockets:offline',
        });
    }

    registerOfflineHandlers(namespace: string, vaultId: string) {
        const registerConnectHandlers = () => {
            if (!this.sockets[namespace]) return;
            this.sockets[namespace].once('connect', () => {
                this.refetchData(vaultId);
                this.emitOnline();
            });
        };

        this.sockets[namespace].on('disconnect', reason => {
            console.log('disconnected namespace', namespace, reason);
        });

        this.sockets[namespace].io.on('error', (err: any) => {
            console.log(err);
            this.emitOffline();
            registerConnectHandlers();
        });

        this.sockets[namespace].on('connect_error', err => {
            this.emitOffline();
            registerConnectHandlers();
        });
    }

    async registerProtocol(vaultId: string | null) {
        if (!vaultId) {
            await this.connectSocket('/acreom-config', 'acreom-config', true);

            return;
        }
        const vaultNamespace = `/vault-${vaultId}`;
        await this.connectSocket(vaultNamespace, vaultId);
    }

    async disconnectProtocol(vaultId: string) {
        if (!vaultId) {
            await this.disconnectSocket('/acreom-config');
            return;
        }
        const vaultNamespace = `/vault-${vaultId}`;
        await this.disconnectSocket(vaultNamespace);
    }

    private async authOptions() {
        const clientId = this.context.$config.clientId;
        const getCredentials = async () => {
            const users = await this.context.invoke<IUser[]>(
                ServiceKey.DATABASE,
                DatabaseServiceAction.LIST,
                {
                    table: 'users',
                    callerContext: 'services.ts/authOptions',
                },
            );
            const user = users?.shift?.() ?? null;
            if (!user || users.length || !user.credentials) {
                return null;
            }
            return user.credentials;
        };
        return {
            auth: async (cb: (data: any) => void): Promise<void> => {
                // check credentials and refresh them when necessary
                let credentials = await getCredentials();
                if (!credentials) {
                    return cb({ token: null });
                }

                if (credentials.expiresAt < Date.now()) {
                    await this.context.$cloudService.User.retrieve();
                    credentials = await getCredentials();
                    if (!credentials) {
                        return cb({ token: null });
                    }
                }
                cb({ clientId, token: credentials.accessToken });
            },
        };
    }
}
