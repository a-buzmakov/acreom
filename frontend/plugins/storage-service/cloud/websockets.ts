import { Manager, Socket } from 'socket.io-client';
import { Context } from '@nuxt/types';
import {
    DatabaseServiceAction,
    GoogleCalendarIntegrationAction,
    ServiceKey,
} from '~/constants';

export class WebsocketsService {
    private context: Context;
    private manager!: Manager;
    private sockets: Record<string, Socket> = {};
    private isReady: boolean = false;
    private isReadyPromise: Promise<void> = Promise.resolve();
    private isReadyPromiseCallback = () => {};

    constructor(ctx: Context) {
        this.context = ctx;
        this.isReadyPromise = new Promise<void>(resolve => {
            this.isReadyPromiseCallback = () => {
                this.isReady = true;
                resolve();
            };
        });
    }

    resetForBaseUrlChange() {
        for (const namespace of Object.keys(this.sockets)) {
            try {
                this.sockets[namespace]?.disconnect();
            } catch (e) {}
            delete this.sockets[namespace];
        }
        if (this.manager) {
            try {
                this.manager.removeAllListeners();
                // @ts-ignore
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

    async initialize() {
        if (!this.manager) {
            this.manager = new Manager(
                this.context.$config.baseUrl
                    .replace('https', 'wss')
                    .replace('http', 'ws'),
                {
                    transports: ['websocket', 'polling'],
                    reconnectionDelay: 1000,
                    reconnection: true,
                    reconnectionAttempts: 100,
                    autoConnect: true,
                },
            );
            this.manager.engine.once('upgrade', () => {
                console.log(
                    'Websockets upgrade',
                    this.manager.engine.transport.name,
                ); // in most cases, prints "websocket"
            });
        }
        this.isReadyPromiseCallback();
        if (!this.sockets['acreom-config']) {
            await this.connectSocket('/acreom-config', 'acreom-config');
        }
        this.manager.open();
    }

    async registerProtocol(vaultId: string) {
        if (!vaultId) {
            await this.connectSocket('/acreom-config', 'acreom-config');
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

    private disconnectSocket(namespace: string) {
        if (!this.isReady) {
            return;
        }
        this.sockets[namespace]?.disconnect();
        delete this.sockets[namespace];
    }

    private async connectSocket(namespace: string, vaultId: string) {
        if (!this.isReady) {
            await this.isReadyPromise;
        }

        const authOptions = this.authOptions();
        this.sockets[namespace] = this.manager.socket(namespace, authOptions);
        this.sockets[namespace].onAny((event, data) => {
            if (event === 'google-calendar-watch') {
                return this.context.$serviceRegistry.emit(
                    ServiceKey.INTEGRATIONS,
                    GoogleCalendarIntegrationAction.WATCH_EMIT,
                    { ...JSON.parse(data), vaultId },
                );
            }
            this.context.$serviceRegistry.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.EMIT,
                {
                    event: `${vaultId}-${event}`,
                    payload: JSON.parse(data),
                    callerContext: 'cloud/websocket.ts connectSocket',
                },
            );
        });
        await new Promise<void>((resolve, reject) => {
            if (this.sockets[namespace].connected) {
                resolve();
                return;
            }
            const timeout = setTimeout(() => {
                reject(new Error('socket connection timeout'));
            }, 30 * 1000);
            this.sockets[namespace].once('connect', () => {
                clearTimeout(timeout);
                resolve();
            });

            this.sockets[namespace].connect();
        });

        console.log('socket connection created', namespace);
    }

    private authOptions() {
        const clientId = this.context.store.getters['auth/clientId'];
        const credentials = this.context.store.getters['auth/credentials'];
        return {
            auth: {
                clientId,
                token: credentials.accessToken,
            },
        };
    }
}
