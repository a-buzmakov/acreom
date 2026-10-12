export const SYNC_CONFIG_STORAGE_KEY = 'syncConfig';

export type SyncConfig = {
    baseUrl: string;
    email: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number | null;
};

export const normalizeSyncBaseUrl = (url: string): string => {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

export const isSyncConfigConfigured = (
    config: Partial<SyncConfig> | null | undefined,
): config is SyncConfig => {
    return Boolean(config?.baseUrl && config?.email);
};

export const applyRuntimeBaseUrl = (
    ctx: {
        $config: Record<string, any>;
        $axios?: { defaults: { baseURL?: string } };
    },
    baseUrl: string,
    selfHostedSync: boolean,
) => {
    const config = ctx.$config;
    if (!config.acreomDefaultBaseUrl) {
        config.acreomDefaultBaseUrl = config.baseUrl;
    }
    config.baseUrl = baseUrl;
    config.selfHostedSync = selfHostedSync;
    if (ctx.$axios?.defaults) {
        ctx.$axios.defaults.baseURL = baseUrl;
    }
};
