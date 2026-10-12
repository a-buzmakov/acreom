<template>
    <div class="account-settings">
        <div v-if="loggedIn" class="account-settings__wrapper">
            <div
                v-if="!image || showLetter"
                class="account-settings__wrapper__letter"
            >
                {{ letter }}
            </div>
            <img v-else :src="image" :alt="email" @error="imageError" />
            <div class="account-settings__wrapper__username">
                {{ username }}
                <div v-if="$accessControl.hasProAccess">
                    <p class="pro-badge">PRO</p>
                </div>
            </div>
            <div class="account-settings__wrapper__email">{{ email }}</div>
            <button class="account-settings__wrapper__log-out" @click="logOut">
                Log Out
            </button>
            <div class="account-settings__wrapper__user-actions">
                <div
                    v-if="showMessage"
                    class="account-settings__wrapper__message"
                >
                    <p
                        v-if="subStatus === 'incomplete'"
                        v-html="
                            retries > retryLimit
                                ? `Fetching subscription status.`
                                : `Something went wrong. Please restart the app. If the problem persists, please reach out to <span>team@acreom.com</span>.`
                        "
                    ></p>
                    <p v-if="subStatus === 'past_due'">
                        acreom couldn't process your payment. Update your
                        payment details.
                    </p>
                    <p v-if="subStatus === 'canceled'">
                        Your subscription has been canceled.
                    </p>
                    <p v-if="subStatus === 'incomplete_expired'">
                        Something went wrong during the subscribe process. Your
                        card has not been charged. Please try subscribing again.
                        If the problem persists contact us at
                        <span>team@acreom.com</span>
                    </p>
                </div>
                <div class="account-settings__wrapper__manage">
                    <div class="account-settings__wrapper__manage__text">
                        <div
                            class="
                                account-settings__wrapper__manage__text__title
                            "
                        >
                            End-to-End Encryption
                        </div>
                        <div
                            class="
                                account-settings__wrapper__manage__text__plan
                            "
                        >
                            <div v-if="isEncryptionEnabled">
                                acreom sync is end-to-end encrypted
                            </div>
                            <div v-else>
                                Enable and set passphrase to encrypt your data
                            </div>
                        </div>
                    </div>
                    <div class="account-settings__wrapper__manage__action">
                        <button
                            v-if="!isEncryptionEnabled"
                            class="manage-sub"
                            @click="toggleEncryption"
                        >
                            Enable Encryption
                        </button>
                        <div
                            v-else
                            class="
                                account-settings__wrapper__manage__encryption-enabled
                            "
                        >
                            Enabled
                            <InterfaceSecurityShield4
                                size="16"
                                class="
                                    account-settings__wrapper__manage__encryption-enabled--icon
                                "
                            />
                        </div>
                    </div>
                </div>
                <div
                    v-if="isEncryptionEnabled && isEncryptionUnlocked"
                    class="account-settings__wrapper__manage"
                >
                    <div class="account-settings__wrapper__manage__text">
                        <div
                            class="
                                account-settings__wrapper__manage__text__title
                            "
                        >
                            Account Recovery Key
                        </div>
                        <div
                            class="
                                account-settings__wrapper__manage__text__plan
                            "
                        >
                            To access your data in case of forgotten password,
                            create a recovery key.
                        </div>
                    </div>
                    <div class="account-settings__wrapper__manage__action">
                        <button class="manage-sub" @click="createRecoveryKey">
                            Create Recovery Key
                        </button>
                    </div>
                </div>
                <div class="account-settings__wrapper__manage">
                    <div class="account-settings__wrapper__manage__text">
                        <div
                            class="
                                account-settings__wrapper__manage__text__title
                            "
                        >
                            Current Plan
                        </div>
                        <div
                            class="
                                account-settings__wrapper__manage__text__plan
                            "
                        >
                            Personal
                        </div>
                    </div>
                </div>
                <div class="account-settings__wrapper__manage">
                    <div class="account-settings__wrapper__manage__text">
                        <div
                            class="
                                account-settings__wrapper__manage__text__title
                            "
                        >
                            Delete Account
                        </div>
                        <div
                            class="
                                account-settings__wrapper__manage__text__plan
                            "
                        >
                            Remove account and all of it’s data.
                        </div>
                    </div>
                    <div class="account-settings__wrapper__manage__action">
                        <button
                            class="manage-sub danger"
                            @click="deleteAccount"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="account-settings__wrapper">
            <div class="account-settings__wrapper__log-in-text">Sign In</div>
            <div class="account-settings__wrapper__log-in-subtext">
                Sign in to access cloud vaults and sync your data with other
                devices.
            </div>
            <div class="account-settings__wrapper__login-buttons">
                <LoginButtons
                    :tab="tab"
                    :disable-no-account="true"
                    :use-modal="true"
                    @update-tab="tab = $event"
                />
            </div>
        </div>
        <div class="account-settings__version">
            version:
            <span @contextmenu.stop.prevent="handleDebugContextMenu">{{
                $store.getters.latest
            }}</span>
            ({{ $utils.fileSystem.getOSArch() }})
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LoginButtons from '@/components/auth/login-buttons';
import CSwitch from '~/components/CSwitch.vue';
import CButton from '~/components/CButton.vue';
import InterfaceLockCircle from '~/components/streamline/InterfaceLockCircle.vue';
import InterfaceLockShield from '~/components/streamline/InterfaceLockShield.vue';
import InterfaceSecurityShield4 from '~/components/streamline/InterfaceSecurityShield4.vue';
import { DatabaseServiceAction, ServiceKey } from '~/constants';
import { TrackEvent } from '~/helpers/decorators';
import {
    TrackingAction,
    TrackingType,
} from '~/@types/tracking';

@Component({
    name: 'AccountSettings',
    components: {
        InterfaceSecurityShield4,
        InterfaceLockShield,
        InterfaceLockCircle,
        CButton,
        CSwitch,
        LoginButtons,
    },
})
export default class AccountSettings extends Vue {
    showLetter: boolean = false;
    retries: number = 0;
    retryLimit: number = 3;
    tab: any = 'home';
    isEncryptionUnlocked: any = false;

    $refs!: {
        version: HTMLElement;
    };

    getEncryptionUnlockedState() {
        return this.$serviceRegistry.invoke(
            ServiceKey.DATABASE,
            DatabaseServiceAction.DID_RESTORE_SESSION_KEY,
            {
                callerContext: 'AccountSettings.vue getEncryptionUnlockedState',
            },
        );
    }

    get showMessage() {
        return [
            'incomplete',
            'past_due',
            'canceled',
            'incomplete_expired',
        ].includes(this.subStatus);
    }

    get loggedIn() {
        return this.$store.getters['auth/loggedIn'];
    }

    get user() {
        return this.$store.getters['auth/user'];
    }

    get isEncryptionEnabled() {
        return !!this.$store.getters['user/user']?.privateKeys;
    }

    get email() {
        return this.user?.email ?? '';
    }

    get username() {
        return this.user?.name;
    }

    get image() {
        if (this.user) {
            return this.user.picture;
        }

        return null;
    }

    get letter() {
        if (this.user) {
            if (this.user.email) return this.user.email[0].toUpperCase();
            else return this.user.name[0].toUpperCase();
        }

        return '#';
    }

    toggleEncryption() {
        this.$vfm.show({
            component: () =>
                import('@/components/modal/EnableEncryptionModal.vue'),
        });
    }

    async createRecoveryKey() {
        const recoveryData = await this.$serviceRegistry.invoke<{
            recoveryKey: string;
            id: string;
        }>(ServiceKey.DATABASE, DatabaseServiceAction.CREATE_RECOVERY_KEY, {
            callerContext: 'AccountSettings.vue createRecoveryKey',
        });
        if (!recoveryData) {
            this.$notification.show({
                component: () =>
                    import('@/components/notifications/ErrorNotification.vue'),
                bind: {
                    displayText: 'Error creating recovery keys',
                },
            });
            return;
        }
        const status = await this.$encryption.createRecoveryJSON(recoveryData);
        if (status) {
            this.$notification.show({
                component: () =>
                    import('@/components/notifications/MiscNotification.vue'),
                bind: {
                    displayText: 'Recovery keys saved',
                },
            });
            return;
        }

        this.$notification.show({
            component: () =>
                import('@/components/notifications/ErrorNotification.vue'),
            bind: {
                displayText: 'Error saving recovery keys',
            },
        });
    }

    async handleDebugContextMenu(e: MouseEvent) {
        await this.$contextMenu.show(e, {
            component: () =>
                import('~/components/context-menu/DebugContextMenu.vue'),
        });
    }

    imageError() {
        this.showLetter = true;
    }

    @TrackEvent(TrackingType.AUTH, {
        action: TrackingAction.LOG_OUT,
    })
    async logOut() {
        await this.$vfm.hideAll();
        await this.$store.dispatch('auth/logout');
    }

    deleteAccount() {
        this.$vfm.show({
            component: () =>
                import('@/components/modal/AccountDeleteModal.vue'),
        });
    }

    get subStatus() {
        return this.$store.getters['user/subscription']?.status;
    }

    retryCheckStatus() {
        this.$store.dispatch('user/checkForUpdate');
        setTimeout(this.setTimedOut, 3 * 1000);
    }

    setTimedOut() {
        this.retries += 1;
        if (this.retries < this.retryLimit) {
            this.retryCheckStatus();
        }
    }

    async mounted() {
        if (this.subStatus === 'incomplete') {
            setTimeout(this.setTimedOut, 3 * 1000);
        }

        this.isEncryptionUnlocked = await this.getEncryptionUnlockedState();
    }
}
</script>

<style lang="scss" scoped>
.account-settings {
    height: 100%;

    &__wrapper {
        padding: 0 20px;
        height: calc(100% - 30px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        &__login-buttons {
            padding: 20px;
            border-radius: 12px;
            margin: 0 auto;
            max-width: 280px;
            width: 100%;
        }

        &__message {
            @include font12-400;
            width: 100%;
            padding: 14px 17px;
            font-style: normal;
            background: var(--settings-modal-my-account-message-bg-color);
            border-radius: 8px;
            margin-bottom: 24px;
        }

        &__manage {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 15px;

            &__text {
                &__title {
                    @include font12-500;
                    color: var(--settings-modal-option-title-color);
                    margin-bottom: 4px;
                }

                &__plan {
                    @include font12-400;
                    color: var(--settings-modal-option-description-color);
                }
            }
            &__encryption-enabled {
                @include font12-500;
                display: flex;
                align-items: center;
                //color: ;

                &--icon {
                    margin-left: 8px;
                    margin-right: 34px;
                }
            }
        }

        &__log-in-text {
            @include font14-600;
            color: var(--settings-modal-title-color);
            margin-bottom: 10px;
        }

        &__log-in-subtext {
            @include font12-500;
            color: var(--modal-body-text-color);
            max-width: 220px;
            margin: 0 auto 20px;
            text-align: center;
        }

        &__letter {
            max-width: 96px;
            background: var(--settings-modal-my-account-letter-bg-color);
            width: 96px;
            height: 96px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            margin-bottom: 20px;
        }

        img {
            max-width: 96px;
            display: block;
            border-radius: 50%;
            margin-bottom: 20px;
        }

        &__username {
            @include font14-600;
            display: flex;
            gap: 4px;
            align-items: center;
            color: var(--settings-modal-title-color);

            .pro-badge {
                @include proBadge;
            }
        }

        &__email {
            @include font12-500;
            color: var(--settings-modal-title-color);
            margin-bottom: 20px;
        }

        &__log-out {
            @include font12-500;
            color: var(--settings-modal-button-primary-text-color);
            background: var(--settings-modal-button-primary-bg-color);
            padding: 4px 30px;
            outline: none;
            border-radius: 6px;
            margin-bottom: 20px;

            &:hover {
                color: var(--settings-modal-button-primary-text-color__hover);
                background: var(
                    --settings-modal-button-primary-bg-color__hover
                );
            }
        }

        &__user-actions {
            margin: 50px 20px 0;
            padding-top: 13px;
            width: 100%;
            border-top: 1px solid var(--tab-divider-color);
            display: flex;
            flex-direction: column;
            align-items: center;

            .manage-sub {
                @include font12-500;
                padding: 4px 30px;
                outline: none;
                background: var(--settings-modal-button-primary-bg-color);
                border-radius: 6px;
                color: var(--settings-modal-button-primary-text-color);
                cursor: default;
                white-space: nowrap;

                &:hover {
                    color: var(
                        --settings-modal-button-primary-text-color__hover
                    );
                    background: var(
                        --settings-modal-button-primary-bg-color__hover
                    );
                }

                &.danger {
                    color: var(--settings-modal-button-danger-text-color);

                    &:hover {
                        color: var(
                            --settings-modal-button-danger-text-color__hover
                        );
                        background: var(
                            --settings-modal-button-danger-bg-color__hover
                        );
                    }
                }
            }
        }
    }

    &__version {
        @include font12-500;
        text-align: center;
        color: var(--settings-modal-my-account-version-color);
    }
}
</style>
