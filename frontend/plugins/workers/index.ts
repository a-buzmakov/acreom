import { Context, Plugin } from '@nuxt/types';
import { Inject } from '@nuxt/types/app';
import { v4 } from 'uuid';

// @ts-ignore
import IntegrationsWorker from '~/assets/webworker/integrations.worker';
// @ts-ignore
import DatabaseWorker from '~/assets/webworker/database.worker';
// @ts-ignore
import SearchWorker from '~/assets/webworker/search.worker';
// @ts-ignore
import UtilsWorker from '~/assets/webworker/utils.worker';
// @ts-ignore
import CloudWorker from '~/assets/webworker/cloud.worker';
// @ts-ignore
import AssistantWorker from '~/assets/webworker/assistant.worker';
// @ts-ignore
import EncryptionWorker from '~/assets/webworker/encryption.worker';

import { IntegrationsWrapper } from '~/plugins/workers/integrations';
import { DatabaseWrapper } from '~/plugins/workers/database';
import {
    AssistantActions,
    CloudServiceAction,
    ServiceKey,
    UtilActions,
} from '~/constants';
import { WorkerContext } from '~/@types/app';
import { SearchWrapper } from '~/plugins/workers/search';
import { UtilsWrapper } from '~/plugins/workers/utils';
import { CloudServiceWrapper } from '~/plugins/workers/cloud';
import { AssistantWrapper } from '~/plugins/workers/assistant';
import { EncryptionWrapper } from '~/plugins/workers/encryption';
import {
    SYNC_CONFIG_STORAGE_KEY,
    SyncConfig,
    applyRuntimeBaseUrl,
} from '~/helpers/sync-config';

declare module '@nuxt/types' {
    interface Context {
        $workers: {
            integrations: IntegrationsWrapper | null;
            database: DatabaseWrapper | null;
            search: SearchWrapper | null;
            utils: UtilsWrapper | null;
            cloud: CloudServiceWrapper | null;
            assistant: AssistantWrapper | null;
            encryption: EncryptionWrapper | null;
        };
    }
}

declare module 'vue/types/vue' {
    interface Vue {
        $workers: {
            database: DatabaseWrapper | null;
            integrations: IntegrationsWrapper | null;
            search: SearchWrapper | null;
            utils: UtilsWrapper | null;
            cloud: CloudServiceWrapper | null;
            assistant: AssistantWrapper | null;
            encryption: EncryptionWrapper | null;
        };
    }
}

const servicesPlugin: Plugin = async (ctx: Context, inject: Inject) => {
    let clientId = ctx.$appStorage.get('clientId');
    if (!clientId) {
        clientId = v4();
        ctx.$appStorage.set('clientId', clientId);
    }

    ctx.store.commit('auth/clientId', clientId);

    const syncConfig = ctx.$appStorage.get(SYNC_CONFIG_STORAGE_KEY) as
        | SyncConfig
        | null;
    if (syncConfig?.baseUrl) {
        applyRuntimeBaseUrl(ctx, syncConfig.baseUrl, true);
        ctx.store.commit('syncConfig/set', {
            baseUrl: syncConfig.baseUrl,
            email: syncConfig.email || '',
            accessToken: syncConfig.accessToken || null,
            refreshToken: syncConfig.refreshToken || null,
            expiresAt: syncConfig.expiresAt ?? null,
            connected: Boolean(
                syncConfig.accessToken && syncConfig.refreshToken,
            ),
        });
    } else {
        const config = ctx.$config as any;
        if (!config.acreomDefaultBaseUrl) {
            config.acreomDefaultBaseUrl = config.baseUrl;
        }
    }

    const integrationsWorkerInstance = new IntegrationsWorker();
    const databaseWorkerInstance = new DatabaseWorker();
    const searchWorkerInstance = new SearchWorker();
    const utilsWorkerInstance = new UtilsWorker();
    const cloudWorkerInstance = new CloudWorker();
    const assistantWorkerInstance = new AssistantWorker();
    const encryptionWorkerInstance = new EncryptionWorker();

    const workers = {
        integrations: new IntegrationsWrapper(integrationsWorkerInstance, ctx),
        database: new DatabaseWrapper(databaseWorkerInstance, ctx),
        search: new SearchWrapper(searchWorkerInstance, ctx),
        utils: new UtilsWrapper(utilsWorkerInstance, ctx),
        cloud: new CloudServiceWrapper(cloudWorkerInstance, ctx),
        assistant: new AssistantWrapper(assistantWorkerInstance, ctx),
        encryption: new EncryptionWrapper(encryptionWorkerInstance, ctx),
    };

    ctx.$workers = workers;

    const registerServices = async () => {
        ctx.$serviceRegistry.register(
            ServiceKey.ENCRYPTION,
            ctx.$workers.encryption,
        );
        ctx.$serviceRegistry.register(
            ServiceKey.ASSISTANT,
            ctx.$workers.assistant,
        );
        ctx.$workers.assistant
            ?.execute(
                AssistantActions.INITIALIZE,
                {
                    context: {
                        ...ctx.$config,
                        clientId: ctx.store.getters['auth/clientId'],
                        onLine: window.navigator.onLine,
                    },
                },
                false,
            )
            .catch(e => {
                e.message =
                    'assistant worker did not initialize itself correctly ' +
                    e.message;
                ctx.$serviceRegistry.emit(ServiceKey.SENTRY, 'trackError', e);
            });
        ctx.$serviceRegistry.register(ServiceKey.UTILS, ctx.$workers.utils);
        ctx.$workers.utils
            ?.execute(
                UtilActions.INITIALIZE,
                {
                    context: {
                        ...ctx.$config,
                        clientId: ctx.store.getters['auth/clientId'],
                        onLine: window.navigator.onLine,
                    },
                },
                false,
            )
            .catch(e => {
                e.message =
                    'utils worker did not initialize itself correctly ' +
                    e.message;
                ctx.$serviceRegistry.emit(ServiceKey.SENTRY, 'trackError', e);
            });
        ctx.$serviceRegistry.register(ServiceKey.SEARCH, ctx.$workers.search);
        await ctx.$workers.cloud
            ?.execute(CloudServiceAction.INITIALIZE, {
                context: {
                    ...ctx.$config,
                    clientId: ctx.store.getters['auth/clientId'],
                    onLine: window.navigator.onLine,
                },
            })
            .catch(e => {
                e.message =
                    'cloud worker did not initialize itself correctly ' +
                    e.message;
                ctx.$serviceRegistry.emit(ServiceKey.SENTRY, 'trackError', e);
            });
        await ctx.$workers.database
            ?.initialize?.({
                ...ctx.$config,
                clientId: ctx.store.getters['auth/clientId'],
                onLine: window.navigator.onLine,
            } as Partial<WorkerContext>)
            .catch(e => {
                e.message =
                    'database worker did not initialize itself correctly ' +
                    e.message;
                ctx.$serviceRegistry.emit(ServiceKey.SENTRY, 'trackError', e);
            });
        ctx.$serviceRegistry.register(
            ServiceKey.DATABASE,
            ctx.$workers.database,
        );
        ctx.$serviceRegistry.register(ServiceKey.CLOUD, ctx.$workers.cloud);
        ctx.$serviceRegistry.register(
            ServiceKey.INTEGRATIONS,
            ctx.$workers.integrations,
        );

        ctx.$workers.integrations
            ?.initialize({
                ...ctx.$config,
                clientId: ctx.store.getters['auth/clientId'],
                onLine: window.navigator.onLine,
            } as Partial<WorkerContext>)
            .catch(e => {
                e.message =
                    'integrations worker did not initialize itself correctly ' +
                    e.message;
                ctx.$serviceRegistry.emit(ServiceKey.SENTRY, 'trackError', e);
            });
        ctx.$commandManager.indexCommands();
    };

    await registerServices();
    inject('workers', workers);
};

export default servicesPlugin;
