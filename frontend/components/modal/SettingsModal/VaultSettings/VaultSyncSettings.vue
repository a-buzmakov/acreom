<template>
    <div class="vault-sync-settings">
        <div class="vault-sync-settings__title">Sync</div>
        <div class="vault-sync-settings__description">
            Connect this client to a self-hosted sync server. Folder sync stays
            under Overview.
        </div>

        <label class="vault-sync-settings__field">
            <div class="vault-sync-settings__label">Server URL</div>
            <input
                v-model="serverUrl"
                type="text"
                spellcheck="false"
                placeholder="https://sync.example.com"
                :disabled="busy"
            />
        </label>

        <label class="vault-sync-settings__field">
            <div class="vault-sync-settings__label">Email</div>
            <input
                v-model="email"
                type="email"
                spellcheck="false"
                placeholder="you@example.com"
                :disabled="busy"
            />
        </label>

        <label class="vault-sync-settings__field">
            <div class="vault-sync-settings__label">Password</div>
            <input
                v-model="password"
                type="password"
                spellcheck="false"
                placeholder="Password"
                :disabled="busy"
                @keydown.enter.prevent.stop="save"
            />
        </label>

        <label
            v-if="vault && vault.type !== 'remote'"
            class="vault-sync-settings__switch"
        >
            <div class="vault-sync-settings__switch__text">
                <div class="vault-sync-settings__label">
                    Enable cloud sync for this vault
                </div>
                <div class="vault-sync-settings__hint">
                    Converts the active vault to a remote vault after a
                    successful save.
                </div>
            </div>
            <CSwitch
                :value="enableCloudSync"
                :disabled="busy"
                @input="enableCloudSync = $event"
            />
        </label>

        <div class="vault-sync-settings__actions">
            <CButton
                type="secondary"
                :disabled="!canTest || busy"
                :loading="testing"
                @click="testConnection"
            >
                Test
            </CButton>
            <CButton
                type="primary"
                :disabled="!canSave || busy"
                :loading="saving"
                @click="save"
            >
                Save
            </CButton>
            <CButton
                v-if="isConfigured"
                type="secondary"
                :disabled="busy"
                :loading="disconnecting"
                @click="disconnect"
            >
                Disconnect
            </CButton>
        </div>

        <div class="vault-sync-settings__status">
            <div class="vault-sync-settings__label">Status</div>
            <div class="vault-sync-settings__status__row">
                <span
                    class="vault-sync-settings__status__dot"
                    :class="statusTone"
                />
                <span>{{ statusText }}</span>
            </div>
            <div
                v-if="lastTestResult"
                class="vault-sync-settings__status__test"
                :class="{ ok: lastTestOk, error: lastTestOk === false }"
            >
                {{ lastTestResult }}
            </div>
            <div
                v-if="syncStatusText"
                class="vault-sync-settings__status__sync"
            >
                Sync: {{ syncStatusText }}
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import CButton from '~/components/CButton.vue';
import CSwitch from '~/components/CSwitch.vue';
import { normalizeSyncBaseUrl } from '~/helpers/sync-config';

@Component({
    name: 'VaultSyncSettings',
    components: { CButton, CSwitch },
})
export default class VaultSyncSettings extends Vue {
    serverUrl = '';
    email = '';
    password = '';
    enableCloudSync = true;
    testing = false;
    saving = false;
    disconnecting = false;

    get busy() {
        return this.testing || this.saving || this.disconnecting;
    }

    get vault() {
        return this.$store.getters['vault/active'];
    }

    get isConfigured() {
        return this.$store.getters['syncConfig/isConfigured'];
    }

    get lastTestResult() {
        return this.$store.getters['syncConfig/lastTestResult'];
    }

    get lastTestOk() {
        return this.$store.getters['syncConfig/lastTestOk'];
    }

    get syncStatusText() {
        if (!this.isConfigured || this.vault?.type !== 'remote') {
            return '';
        }
        return this.$store.getters['syncStatus/statusText'] || '';
    }

    get canTest() {
        return Boolean(
            this.serverUrl.trim() &&
                this.email.trim() &&
                this.password.trim(),
        );
    }

    get canSave() {
        return this.canTest;
    }

    get statusTone() {
        if (this.lastTestOk === false) return 'error';
        if (this.$store.getters['syncConfig/connected']) return 'ok';
        if (this.isConfigured) return 'warn';
        return 'idle';
    }

    get statusText() {
        if (this.$store.getters['syncConfig/connected']) {
            return `Connected to ${this.$store.getters['syncConfig/config']?.baseUrl}`;
        }
        if (this.isConfigured) {
            return 'Sync server configured. Sign in again to reconnect.';
        }
        return 'Not connected to a sync server.';
    }

    mounted() {
        const config = this.$store.getters['syncConfig/config'];
        if (config) {
            this.serverUrl = config.baseUrl || '';
            this.email = config.email || '';
        }
        this.enableCloudSync = this.vault?.type !== 'remote';
    }

    private clientFor(baseUrl: string) {
        return axios.create({
            baseURL: baseUrl,
            timeout: 8000,
        });
    }

    private async probe(baseUrl: string, email: string, password: string) {
        const client = this.clientFor(baseUrl);
        const health = await client.get('/health');
        if (health.status !== StatusCodes.OK) {
            throw new Error(`Health check failed (${health.status})`);
        }
        const login = await client.post('/api/auth/login', {
            email,
            password,
        });
        if (login.status !== StatusCodes.OK || !login.data?.accessToken) {
            throw new Error('Login failed');
        }
        return login.data as {
            accessToken: string;
            refreshToken: string;
            expiresAt?: number | string;
            user?: any;
        };
    }

    async testConnection() {
        if (!this.canTest) return;
        this.testing = true;
        try {
            const baseUrl = normalizeSyncBaseUrl(this.serverUrl);
            await this.probe(baseUrl, this.email.trim(), this.password);
            await this.$store.dispatch('syncConfig/setTestResult', {
                ok: true,
                message: `OK — ${baseUrl} accepted credentials`,
            });
        } catch (e: any) {
            await this.$store.dispatch('syncConfig/setTestResult', {
                ok: false,
                message:
                    e?.response?.data?.detail ||
                    e?.message ||
                    'Connection test failed',
            });
        } finally {
            this.testing = false;
        }
    }

    async save() {
        if (!this.canSave) return;
        this.saving = true;
        try {
            const baseUrl = normalizeSyncBaseUrl(this.serverUrl);
            const email = this.email.trim();
            const loginData = await this.probe(
                baseUrl,
                email,
                this.password,
            );

            await this.$store.dispatch('syncConfig/save', {
                baseUrl,
                email,
                accessToken: loginData.accessToken,
                refreshToken: loginData.refreshToken,
                expiresAt: loginData.expiresAt
                    ? Number(loginData.expiresAt)
                    : null,
            });

            await this.$store.dispatch('auth/inPlaceLogin', {
                access_token: loginData.accessToken,
                refresh_token: loginData.refreshToken,
                expires_at: String(loginData.expiresAt ?? ''),
            });

            const vault = this.vault;
            if (
                vault?.id &&
                (this.enableCloudSync || vault.type === 'remote')
            ) {
                if (vault.type !== 'remote') {
                    await this.$entities.vault.saveToStore({
                        id: vault.id,
                        type: 'remote',
                    });
                }
                await this.$entities.vault.turnOnCloudSync(vault.id);
            }

            this.password = '';
            await this.$store.dispatch('syncConfig/setTestResult', {
                ok: true,
                message: `Saved — syncing via ${baseUrl}`,
            });
        } catch (e: any) {
            await this.$store.dispatch('syncConfig/setTestResult', {
                ok: false,
                message:
                    e?.response?.data?.detail ||
                    e?.message ||
                    'Failed to save sync settings',
            });
        } finally {
            this.saving = false;
        }
    }

    async disconnect() {
        this.disconnecting = true;
        try {
            await this.$store.dispatch('syncConfig/disconnect');
            this.password = '';
            await this.$store.dispatch('syncConfig/setTestResult', {
                ok: null,
                message: 'Disconnected from sync server',
            });
        } finally {
            this.disconnecting = false;
        }
    }
}
</script>

<style lang="scss" scoped>
.vault-sync-settings {
    padding: 30px;

    &__title {
        @include font14-600;
        color: var(--settings-modal-title-color);
        margin-bottom: 8px;
    }

    &__description {
        @include font12-500;
        color: var(--settings-modal-option-description-color);
        margin-bottom: 24px;
    }

    &__field {
        display: block;
        margin-bottom: 14px;

        input {
            @include inputMetaStyles;
            @include font12-500;
            padding: 7px 11px;
            background: var(--vault-settings-input-bg-color);
            width: 100%;
            color: var(--vault-settings-input-text-color);
            border-radius: 6px;
            outline: none;

            &::placeholder {
                color: var(--vault-settings-input-placeholder-color);
            }

            &:disabled {
                opacity: 0.6;
            }
        }
    }

    &__label {
        @include font12-600;
        color: var(--settings-modal-title-color);
        margin-bottom: 4px;
    }

    &__hint {
        @include font12-500;
        color: var(--settings-modal-option-description-color);
    }

    &__switch {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin: 8px 0 20px;

        &__text {
            flex: 1;
        }
    }

    &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 24px;
    }

    &__status {
        padding-top: 8px;
        border-top: 1px solid var(--tab-divider-color);

        &__row {
            @include font12-500;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--settings-modal-option-description-color);
            margin-bottom: 6px;
        }

        &__dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--settings-modal-option-description-color);

            &.ok {
                background: #3bb273;
            }

            &.warn {
                background: #d4a017;
            }

            &.error {
                background: #e25555;
            }
        }

        &__test {
            @include font12-500;
            margin-bottom: 4px;

            &.ok {
                color: #3bb273;
            }

            &.error {
                color: #e25555;
            }
        }

        &__sync {
            @include font12-500;
            color: var(--settings-modal-option-description-color);
        }
    }
}
</style>
