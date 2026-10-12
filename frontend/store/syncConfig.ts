import { Context } from '@nuxt/types';
import {
    SYNC_CONFIG_STORAGE_KEY,
    SyncConfig,
    applyRuntimeBaseUrl,
    normalizeSyncBaseUrl,
} from '~/helpers/sync-config';
import {
    CloudServiceAction,
    DatabaseServiceAction,
    ServiceKey,
} from '~/constants';

interface AppState {
    baseUrl: string;
    email: string;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    connected: boolean;
    lastTestResult: string | null;
    lastTestOk: boolean | null;
}

export const state = (): AppState => ({
    baseUrl: '',
    email: '',
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    connected: false,
    lastTestResult: null,
    lastTestOk: null,
});

export const getters = {
    config(state: AppState): SyncConfig | null {
        if (!state.baseUrl) return null;
        return {
            baseUrl: state.baseUrl,
            email: state.email,
            accessToken: state.accessToken || undefined,
            refreshToken: state.refreshToken || undefined,
            expiresAt: state.expiresAt,
        };
    },
    isConfigured(state: AppState) {
        return Boolean(state.baseUrl && state.email);
    },
    connected(state: AppState) {
        return state.connected;
    },
    lastTestResult(state: AppState) {
        return state.lastTestResult;
    },
    lastTestOk(state: AppState) {
        return state.lastTestOk;
    },
};

export const mutations = {
    set(state: AppState, config: Partial<AppState>) {
        if (typeof config.baseUrl === 'string') {
            state.baseUrl = config.baseUrl;
        }
        if (typeof config.email === 'string') {
            state.email = config.email;
        }
        if (config.accessToken !== undefined) {
            state.accessToken = config.accessToken;
        }
        if (config.refreshToken !== undefined) {
            state.refreshToken = config.refreshToken;
        }
        if (config.expiresAt !== undefined) {
            state.expiresAt = config.expiresAt;
        }
        if (typeof config.connected === 'boolean') {
            state.connected = config.connected;
        }
        if (config.lastTestResult !== undefined) {
            state.lastTestResult = config.lastTestResult;
        }
        if (config.lastTestOk !== undefined) {
            state.lastTestOk = config.lastTestOk;
        }
    },
    clear(state: AppState) {
        state.baseUrl = '';
        state.email = '';
        state.accessToken = null;
        state.refreshToken = null;
        state.expiresAt = null;
        state.connected = false;
        state.lastTestResult = null;
        state.lastTestOk = null;
    },
};

const persist = (ctx: Context, state: AppState) => {
    if (!state.baseUrl) {
        ctx.$appStorage.delete(SYNC_CONFIG_STORAGE_KEY);
        return;
    }
    const payload: SyncConfig = {
        baseUrl: state.baseUrl,
        email: state.email,
        accessToken: state.accessToken || undefined,
        refreshToken: state.refreshToken || undefined,
        expiresAt: state.expiresAt,
    };
    ctx.$appStorage.set(SYNC_CONFIG_STORAGE_KEY, payload);
};

export const actions = {
    initialize(this: Context, { commit }: any) {
        const stored = this.$appStorage.get(SYNC_CONFIG_STORAGE_KEY) as
            | SyncConfig
            | null;
        if (!stored?.baseUrl) {
            commit('clear');
            return;
        }
        commit('set', {
            baseUrl: stored.baseUrl,
            email: stored.email || '',
            accessToken: stored.accessToken || null,
            refreshToken: stored.refreshToken || null,
            expiresAt: stored.expiresAt ?? null,
            connected: Boolean(stored.accessToken && stored.refreshToken),
        });
        applyRuntimeBaseUrl(this, stored.baseUrl, true);
    },

    async applyBaseUrl(
        this: Context,
        { getters }: any,
        {
            baseUrl,
            selfHostedSync = true,
        }: { baseUrl: string; selfHostedSync?: boolean },
    ) {
        const normalized = normalizeSyncBaseUrl(baseUrl);
        applyRuntimeBaseUrl(this, normalized, selfHostedSync);
        this.$cloudService?.Websockets?.resetForBaseUrlChange?.();

        await Promise.all([
            this.$workers.cloud?.execute(CloudServiceAction.SET_BASE_URL, {
                baseUrl: normalized,
                selfHostedSync,
                callerContext: 'store/syncConfig.ts applyBaseUrl',
            }),
            this.$serviceRegistry.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.SET_BASE_URL,
                {
                    payload: {
                        baseUrl: normalized,
                        selfHostedSync,
                    },
                    callerContext: 'store/syncConfig.ts applyBaseUrl',
                },
            ),
        ]);

        return getters.config;
    },

    async save(
        this: Context,
        { commit, state, dispatch }: any,
        config: {
            baseUrl: string;
            email: string;
            accessToken?: string;
            refreshToken?: string;
            expiresAt?: number | null;
        },
    ) {
        const normalized = normalizeSyncBaseUrl(config.baseUrl);
        commit('set', {
            baseUrl: normalized,
            email: config.email.trim(),
            accessToken: config.accessToken || null,
            refreshToken: config.refreshToken || null,
            expiresAt: config.expiresAt ?? null,
            connected: Boolean(config.accessToken && config.refreshToken),
        });
        persist(this, state);
        await dispatch('applyBaseUrl', {
            baseUrl: normalized,
            selfHostedSync: true,
        });
    },

    setTestResult(
        { commit }: any,
        { ok, message }: { ok: boolean | null; message: string },
    ) {
        commit('set', {
            lastTestOk: ok,
            lastTestResult: message,
        });
    },

    async disconnect(this: Context, { commit, rootGetters }: any) {
        const defaultBaseUrl =
            (this.$config as any).acreomDefaultBaseUrl || this.$config.baseUrl;

        commit('clear');
        this.$appStorage.delete(SYNC_CONFIG_STORAGE_KEY);

        applyRuntimeBaseUrl(this, defaultBaseUrl, false);
        this.$cloudService?.Websockets?.resetForBaseUrlChange?.();

        await Promise.all([
            this.$workers.cloud?.execute(CloudServiceAction.SET_BASE_URL, {
                baseUrl: defaultBaseUrl,
                selfHostedSync: false,
                callerContext: 'store/syncConfig.ts disconnect',
            }),
            this.$serviceRegistry.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.SET_BASE_URL,
                {
                    payload: {
                        baseUrl: defaultBaseUrl,
                        selfHostedSync: false,
                    },
                    callerContext: 'store/syncConfig.ts disconnect',
                },
            ),
            this.$workers.cloud?.execute(CloudServiceAction.CLEAR_CACHE, {
                callerContext: 'store/syncConfig.ts disconnect',
            }),
        ]);

        const vault = rootGetters['vault/active'];
        if (vault?.type === 'remote' && vault?.id) {
            await this.$entities.vault.turnOffCloudSync(vault.id);
        }

        localStorage.removeItem('acr');
    },
};
