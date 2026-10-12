<template>
    <div class="workspace-selector-dropdown">
        <div class="workspace-selector-dropdown__wrapper">
            <div class="workspace-selector-dropdown__wrapper__list">
                <button
                    v-for="vault in $store.getters['vault/list']"
                    :key="vault.id"
                    class="workspace-selector-dropdown__vault"
                    :class="{
                        active: $store.getters['vault/active'].id === vault.id,
                        locked: isLocked(vault.id),
                    }"
                    @click="selectVault(vault.id)"
                >
                    <div
                        class="workspace-selector-dropdown__vault__letter"
                        :style="{
                            backgroundColor: $store.getters['vault/color'](
                                vault.id,
                            ),
                        }"
                    >
                        <span>{{ (vault.name && vault.name[0]) || '#' }}</span>
                    </div>
                    <div class="workspace-selector-dropdown__vault__text">
                        <div
                            class="
                                workspace-selector-dropdown__vault__text__title
                            "
                        >
                            {{ vault.name }}
                        </div>
                        <div
                            class="
                                workspace-selector-dropdown__vault__text__subtitle
                            "
                        >
                            {{
                                vault.type === 'remote'
                                    ? email
                                    : 'On this device'
                            }}
                        </div>
                    </div>
                    <div
                        v-if="isLocked(vault.id)"
                        class="workspace-selector-dropdown__vault__lock"
                    >
                        <InterfaceLock />
                    </div>
                </button>
            </div>
            <button
                class="workspace-selector-dropdown__vault"
                @click="newVault"
            >
                <div
                    class="workspace-selector-dropdown__vault__letter new-vault"
                >
                    <PlusIcon size="20" class="icon" />
                </div>
                <div class="workspace-selector-dropdown__vault__text">
                    <div
                        class="
                            workspace-selector-dropdown__vault__text__title
                            new-vault
                        "
                    >
                        New Vault
                    </div>
                </div>
            </button>
        </div>

        <div class="divider"></div>

        <button
            class="workspace-selector-dropdown__option"
            data-e2e="workspace-selector-preferences"
            @click="openSettings"
        >
            <div class="workspace-selector-dropdown__option__icon">
                <InterfaceSettingCog size="16" class="icon" />
            </div>
            <div class="workspace-selector-dropdown__option__text">
                Settings
            </div>
        </button>
        <button
            v-if="$config.platform === 'desktop'"
            class="workspace-selector-dropdown__option"
            @click="openImport"
        >
            <div class="workspace-selector-dropdown__option__icon">
                <InterfaceUploadSquareAlternate
                    size="16"
                    class="icon import-icon"
                />
            </div>
            <div class="workspace-selector-dropdown__option__text">Import</div>
        </button>
    </div>
</template>

<script lang="ts">
import ClickOutside from 'vue-click-outside';
import { Component, Vue } from 'vue-property-decorator';
import {
    CogIcon,
    LockClosedIcon,
    PlusIcon,
    UploadIcon,
} from '@vue-hero-icons/solid';
import { mapGetters } from 'vuex';
import { isElectron } from '~/helpers/is-electron';
import LoadingIcon from '~/components/icons/LoadingIcon.vue';
import DesktopSyncStatus from '~/components/sidebar/DesktopSyncStatus.vue';
import InterfaceUploadSquareAlternate from '~/components/streamline/InterfaceUploadSquareAlternate.vue';
import InterfaceSettingCog from '~/components/streamline/InterfaceSettingCog.vue';
import { DatabaseServiceAction, ServiceKey } from '~/constants';
import InterfaceLock from '~/components/streamline/InterfaceLock.vue';
import { TrackEvent } from '~/helpers/decorators';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';

@Component({
    components: {
        InterfaceLock,
        InterfaceSettingCog,
        InterfaceUploadSquareAlternate,
        DesktopSyncStatus,
        LoadingIcon,
        PlusIcon,
        CogIcon,
        UploadIcon,
        LockClosedIcon,
    },
    directives: {
        ClickOutside,
    },
    computed: {
        ...mapGetters({
            user: 'auth/user',
        }),
    },
})
export default class WorkspaceSelector extends Vue {
    isElectron: boolean = isElectron();
    sessionKeyStored: boolean = false;

    async mounted() {
        this.sessionKeyStored = !!(await this.$serviceRegistry.invoke(
            ServiceKey.DATABASE,
            DatabaseServiceAction.DID_RESTORE_SESSION_KEY,
            {
                callerContext: 'WorkspaceSelectorDropdown.vue mounted',
            },
        ));
    }

    get user() {
        return this.$store.getters['auth/user'];
    }

    get email() {
        if (this.user) {
            if (this.user.email) return this.user.email;
            else return this.user.name;
        }

        return '';
    }

    openSettings() {
        this.$emit('close');
        this.$utils.navigation.openSettings(
            'preferences',
            TrackingActionSource.VAULT_SELECTOR,
        );
    }

    openImport() {
        this.$emit('close');
        this.$vfm.show({
            component: () => import('~/components/modal/ImportModal.vue'),
        });
    }

    login() {
        this.$emit('close');
        this.$vfm.show({
            component: () => import('~/components/modal/LogInModal.vue'),
        });
    }

    newVault() {
        this.$emit('close');
        this.$vfm.show({
            component: () => import('~/components/modal/NewVaultModal.vue'),
        });
    }

    isLocked(id: string) {
        const vault = this.$store.getters['vault/byId'](id);
        if (vault.type === 'remote' && this.user.privateKeys) {
            return !this.sessionKeyStored;
        }

        return false;
    }

    @TrackEvent(TrackingType.VAULT, {
        action: TrackingAction.SWITCH,
    })
    async selectVault(id: string) {
        this.$emit('close');
        const vault = this.$store.getters['vault/byId'](id);
        if (vault.type === 'remote' && this.user.privateKeys) {
            const isUnlocked = await this.$serviceRegistry.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.DID_RESTORE_SESSION_KEY,
                {
                    callerContext: 'WorkspaceSelectorDropdown.vue selectVault',
                },
            );
            if (!isUnlocked) {
                this.$encryption.openPassphraseModal(() => {
                    this.$serviceRegistry.emit(
                        ServiceKey.DATABASE,
                        DatabaseServiceAction.INITIALIZE_VAULTS_SYNC,
                        {},
                    );
                    this.$store.dispatch('vault/activate', id);
                });
                return;
            }
        }
        this.$store.dispatch('vault/activate', id);
    }

    get vaultName() {
        const id = this.$store.getters['vault/active']?.id ?? '';
        const vault = this.$store.getters['vault/byId'](id);
        return vault?.name ?? '';
    }

    get loggedIn() {
        return this.$store.getters['auth/loggedIn'];
    }
}
</script>

<style lang="scss" scoped>
.loading-icon {
    margin-left: 8px;
}

.workspace-selector-dropdown {
    @include frostedGlassBackground;
    position: relative;
    user-select: none;
    width: 228px;
    border-radius: 8px;
    top: calc(100% - 8px);
    padding: 8px;

    .divider {
        height: 1px;
        background-color: var(--workspace-selector-dropdown-divider-color);
        margin: 4px 0;
    }

    &__vault {
        outline: none;
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 15px;
        border-radius: 6px;
        align-items: center;
        text-align: left;
        padding: 8px 13px;
        width: 100%;
        color: var(--workspace-selector-dropdown-text-color);
        margin-bottom: 2px;

        &.locked {
            grid-template-columns: 24px minmax(0, 1fr) 14px;
        }

        &.active {
            @include frostedGlassButton;
            color: var(--workspace-selector-dropdown-text-color__hover);
        }

        &:hover {
            @include frostedGlassButton;
            color: var(--workspace-selector-dropdown-text-color__hover);

            .workspace-selector__popup__vault__text__subtitle {
                @include ellipsis;
            }
        }

        &__wrapper {
            margin-bottom: 10px;
            width: 100%;

            &__list {
                @include scrollbar;
                overflow-y: auto;
                max-height: 250px;
            }
        }

        &__letter {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            color: var(--workspace-selector-icon-color);

            &.new-vault {
                background-color: var(--workspace-selector-icon-new-color);
            }
        }

        &__text {
            display: flex;
            flex-direction: column;
            justify-content: center;

            &__title {
                @include ellipsis;
                font-style: normal;
                font-weight: 600;
                font-size: 13px;
                line-height: 1;
                padding-bottom: 3px;

                &.new-vault {
                    padding-bottom: 0;
                }
            }

            &__subtitle {
                @include animateBackgroundColor;
                @include ellipsis;
                font-weight: 500;
                font-size: 12px;
                line-height: 1.3;
                margin-top: -2px;
                letter-spacing: 0.03em;
                color: var(--workspace-selector-dropdown-subtext-color);
            }
        }
    }

    a {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;

        .discord-icon {
            margin-left: -2px;
            margin-right: 3px;
        }
    }

    &__option {
        outline: none;
        display: flex;
        border-radius: 6px;
        align-items: center;
        text-align: left;
        padding: 8px 13px;
        width: 100%;
        color: var(--workspace-selector-dropdown-text-color);

        &__icon {
            margin-left: 2px;
            margin-right: 17px;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .icon {
            flex-shrink: 0;
        }

        &__text {
            font-style: normal;
            font-weight: 600;
            font-size: 13px;
            line-height: 1;
        }

        &:hover {
            @include frostedGlassButton;
            color: var(--workspace-selector-dropdown-text-color__hover);
        }
    }
}
</style>
