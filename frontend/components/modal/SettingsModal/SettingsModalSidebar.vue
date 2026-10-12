<template>
    <div class="settings-modal-sidebar">
        <div class="settings-modal-sidebar__section">
            <div class="settings-modal-sidebar__section__title">General</div>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'myAccount' }"
                data-e2e="settings-My Account"
                @click="$emit('tab:change', 'myAccount')"
            >
                My Account
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'preferences' }"
                data-e2e="settings-Preferences"
                @click="$emit('tab:change', 'preferences')"
            >
                Preferences
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'keybinds' }"
                data-e2e="settings-Keybinds"
                @click="$emit('tab:change', 'keybinds')"
            >
                Keybinds
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'appearance' }"
                data-e2e="settings-Appearance"
                @click="$emit('tab:change', 'appearance')"
            >
                Appearance
            </button>
        </div>
        <div class="settings-modal-sidebar__section">
            <div class="settings-modal-sidebar__section__title">Vault</div>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'overview' }"
                data-e2e="settings-Overview"
                @click="$emit('tab:change', 'overview')"
            >
                Overview
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'sync' }"
                data-e2e="settings-Sync"
                @click="$emit('tab:change', 'sync')"
            >
                Sync
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'calendars' }"
                data-e2e="settings-Calendars"
                @click="$emit('tab:change', 'calendars')"
            >
                Calendars
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'notifications' }"
                data-e2e="settings-Notifications"
                @click="$emit('tab:change', 'notifications')"
            >
                Notifications
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'labels' }"
                data-e2e="settings-Labels"
                @click="$emit('tab:change', 'labels')"
            >
                Labels
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'templates' }"
                data-e2e="settings-Templates"
                @click="$emit('tab:change', 'templates')"
            >
                Templates
            </button>
            <button
                v-if="isRemote"
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'assistant' }"
                data-e2e="settings-Assistant"
                @click="$emit('tab:change', 'assistant')"
            >
                Assistant
            </button>
            <button
                v-if="isRemote"
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'jira-integration' }"
                data-e2e="settings-Jira"
                @click="$emit('tab:change', 'jira-integration')"
            >
                Jira
            </button>
            <button
                v-if="isRemote"
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'linear-integration' }"
                data-e2e="settings-Linear"
                @click="$emit('tab:change', 'linear-integration')"
            >
                Linear
            </button>
            <button
                v-if="isRemote"
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'github-integration' }"
                data-e2e="settings-Github"
                @click="$emit('tab:change', 'github-integration')"
            >
                GitHub
            </button>
            <button
                class="settings-modal-sidebar__section__item"
                :class="{ active: activeTab === 'sidebar' }"
                data-e2e="settings-Sidebar"
                @click="$emit('tab:change', 'sidebar')"
            >
                Sidebar
            </button>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({
    name: 'SettingsModalSidebar',
})
export default class SettingsModalSidebar extends Vue {
    @Prop({
        required: true,
    })
    activeTab!: string;

    get vaultName() {
        const id = this.$store.getters['vault/active']?.id || null;
        return this.$store.getters['vault/byId'](id)?.name || '';
    }

    get isRemote() {
        return this.$store.getters['vault/active'].type === 'remote';
    }
}
</script>

<style lang="scss" scoped>
.settings-modal-sidebar {
    @include scrollbar;
    overflow-y: overlay;
    border-right: 1px solid var(--tab-divider-color);
    padding: 18px 8px;
    user-select: none;

    &__section {
        margin-bottom: 15px;

        &__title {
            @include ellipsis;
            @include font10-700;
            text-transform: uppercase;
            color: var(--settings-modal-sidebar-title-color);
            padding: 0 10px;
            font-weight: 700;
            font-size: 11px;
            line-height: 18px;
            margin-bottom: 3px;
            width: 100%;
        }

        &__item {
            @include font12-500;
            outline: none;
            display: block;
            padding: 6px 10px;
            width: 100%;
            border-radius: 6px;
            text-align: left;
            margin-bottom: 2px;
            color: var(--settings-modal-sidebar-item-text-color);

            &.active,
            &:hover {
                color: var(--settings-modal-sidebar-item-text-color__hover);
                background: var(--settings-modal-sidebar-item-bg-color__hover);
            }
        }
    }
}
</style>
