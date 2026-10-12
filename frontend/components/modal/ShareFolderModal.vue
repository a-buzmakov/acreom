<template>
    <vue-final-modal
        v-slot="{ close }"
        v-bind="$attrs"
        classes="modal-container"
        content-class="modal-content"
        :esc-to-close="true"
        :click-to-close="true"
        overlay-transition="fade"
        :content-style="{
            maxWidth: '367px',
            width: '100%',
        }"
        :overlay-style="{
            backgroundColor:
                $store.getters['appSettings/theme'] === 'DARK'
                    ? '#000000'
                    : '#EAECEF',
            opacity: '0.8',
        }"
        transition="slide-fade"
        v-on="$listeners"
    >
        <div class="sharing-modal">
            <div class="sharing-modal__header">
                <div class="sharing-modal__header__title">Share Folder</div>
                <button @click="close">
                    <XIcon size="20" class="icon" />
                </button>
            </div>
            <div class="sharing-modal__body" :class="{ enabled: share }">
                <label for="share" class="sharing-modal__body__label">
                    <div class="sharing-modal__body__icon">
                        <GlobeIcon size="20" />
                    </div>
                    <p>Public</p>
                    <CSwitch
                        id="share"
                        :value="share"
                        @input="handleSharingToggle"
                    />
                </label>
                <div v-if="share">
                    <p class="link">
                        {{ sharingLink }}
                    </p>
                    <CButton type="tertiary" @click="copyLink">
                        <InterfaceLink size="14" />
                        Copy Link
                    </CButton>
                </div>
            </div>
        </div>
    </vue-final-modal>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { GlobeIcon, XIcon } from '@vue-hero-icons/solid';
import CButton from '@/components/CButton.vue';
import CSwitch from '@/components/CSwitch.vue';
import { IFolder } from '~/@types';
import InterfaceLink from '~/components/streamline/InterfaceLink.vue';
import { TrackingAction, TrackingType } from '~/@types/tracking';
import { TrackEvent } from '~/helpers/decorators';

@Component({
    components: {
        InterfaceLink,
        CButton,
        CSwitch,
        GlobeIcon,
        XIcon,
    },
})
export default class ShareModal extends Vue {
    @Prop({ required: true })
    folder!: IFolder;

    get folderData() {
        return this.$entities.folder.byId(this.folder.id);
    }

    get share() {
        return this.folderData!.sharingUuid;
    }

    get sharingLink() {
        const origin = this.$config.baseUrl.replace(
            /(\w+)?(?:api-1\.)|(?:-api)|(?:api\.)|(?:-1-api)/i,
            'sharing.',
        );
        return this.share ? `${origin}/p/${this.folderData!.sharingUuid}` : '';
    }

    async handleSharingToggle(value: boolean) {
        await this.$entities.folder.toggleSharing(this.folder.id, value);
        if (value) {
            this.copyLink();
        }
    }

    @TrackEvent(TrackingType.SHARING, {
        action: TrackingAction.COPY_LINK_FOLDER,
    })
    copyLink() {
        try {
            this.$utils.copyToClipboard(this.sharingLink);
        } catch (error) {
            // @ts-ignore
            this.$sentry.captureException(error);
            console.log(error);
        }
    }
}
</script>

<style scoped lang="scss">
.sharing-modal {
    @include modal;
    max-width: 367px;
    width: 100%;
    padding: 0px;

    &__header {
        user-select: none;
        padding: 16px 25px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--tab-divider-color);

        &__title {
            @include font14-600;
            color: var(--modal-title-text-color);
        }
    }

    &__body {
        padding: 20px 25px 22px 25px;

        .link {
            @include font12-500;
            white-space: nowrap;
            overflow: hidden;
            color: var(--vault-settings-input-text-color);
            padding: 4px;
            border-radius: 6px;
            background: var(--vault-settings-input-bg-color);
            margin-bottom: 6px;
        }

        .enabled &__label p {
            color: var(--share-modal-label-text-color__enabled);
            user-select: none;
        }

        &__label {
            display: flex;
            align-items: center;
            padding: 4px;
            border-radius: 6px;
            margin-bottom: 6px;
            user-select: none;

            &.disabled {
                opacity: 0.5;
            }

            &:not(.disabled):hover {
                background: var(--share-modal-label-bg-color__hover);

                p {
                    color: var(--share-modal-label-text-color__enabled);
                }
            }

            p {
                @include font12-500;
                color: var(--modal-body-text-color);
            }

            .toggle-slider {
                margin-left: auto;
            }
        }

        &__icon {
            margin-right: 12px;
            background: var(--share-modal-icon-bg-color);
            color: var(--share-modal-icon-text-color);
            padding: 6px;
            border-radius: 6px;
        }
    }
}
</style>
