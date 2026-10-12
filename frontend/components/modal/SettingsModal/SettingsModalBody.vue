<template>
    <div class="settings-modal-body">
        <Preferences v-if="activeTab === 'preferences'" />
        <Keybinds v-if="!$utils.isMobile && activeTab === 'keybinds'" />
        <Appearance v-if="!$utils.isMobile && activeTab === 'appearance'" />
        <AssistantSettings v-if="activeTab === 'assistant'" />
        <AccountSettings v-if="activeTab === 'myAccount'" />
        <VaultOverviewSettings v-if="activeTab === 'overview'" />
        <VaultSyncSettings v-if="activeTab === 'sync'" />
        <VaultCalendarSettings v-if="activeTab === 'calendars'" />
        <VaultNotificationsSettings v-if="activeTab === 'notifications'" />
        <TemplatesSettings v-if="activeTab === 'templates'" />
        <JiraIntegrationSettings v-if="activeTab === 'jira-integration'" />
        <LinearIntegrationSettings v-if="activeTab === 'linear-integration'" />
        <LabelsSettings v-if="activeTab === 'labels'" />
        <GitHubIntegrationSettings v-if="activeTab === 'github-integration'" />
        <SidebarSettings v-if="activeTab === 'sidebar'" />
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import Preferences from '~/components/modal/SettingsModal/Preferences/Preferences.vue';
import Keybinds from '~/components/modal/SettingsModal/Keybinds/Keybinds.vue';
import AccountSettings from '~/components/modal/SettingsModal/Account/AccountSettings.vue';
import VaultOverviewSettings from '~/components/modal/SettingsModal/VaultSettings/VaultOverviewSettings.vue';
import VaultSyncSettings from '~/components/modal/SettingsModal/VaultSettings/VaultSyncSettings.vue';
import VaultCalendarSettings from '~/components/modal/SettingsModal/VaultSettings/VaultCalendarSettings.vue';
import VaultNotificationsSettings from '~/components/modal/SettingsModal/VaultSettings/VaultNotificationsSettings.vue';
import TemplatesSettings from '~/components/modal/SettingsModal/Templates/TemplatesSettings.vue';
import AssistantSettings from '~/components/modal/SettingsModal/Assistant/AssistantSettings.vue';
import JiraIntegrationSettings from '~/components/modal/SettingsModal/JiraIntegration/JiraIntegrationSettings.vue';
import Appearance from '~/components/modal/SettingsModal/Appearance/Appearance.vue';
import LabelsSettings from '~/components/modal/SettingsModal/Labels/LabelsSettings.vue';
import GitHubIntegrationSettings from '~/components/modal/SettingsModal/GitHub/GitHubIntegrationSettings.vue';
import SidebarSettings from '~/components/modal/SettingsModal/Sidebar/SidebarSettings.vue';
import LinearIntegrationSettings from '~/components/modal/SettingsModal/LinearIntegration/LinearIntegrationSettings.vue';

@Component({
    name: 'SettingsModalBody',
    components: {
        LinearIntegrationSettings,
        GitHubIntegrationSettings,
        SidebarSettings,
        LabelsSettings,
        Appearance,
        VaultNotificationsSettings,
        VaultCalendarSettings,
        VaultOverviewSettings,
        VaultSyncSettings,
        AccountSettings,
        Preferences,
        Keybinds,
        TemplatesSettings,
        AssistantSettings,
        JiraIntegrationSettings,
    },
})
export default class SettingsModalBody extends Vue {
    @Prop({
        required: true,
    })
    activeTab!: string;
}
</script>

<style lang="scss" scoped>
.settings-modal-body {
    //@include scrollbar(6px, 6px);
    overflow-y: overlay;
    user-select: none;

    &::-webkit-scrollbar-track {
        background-color: transparent;
    }

    &::-webkit-scrollbar {
        padding: 10px 10px;
        width: 20px;
        background-color: transparent;
        cursor: default;
    }

    &::-webkit-scrollbar-thumb {
        @include animateBackgroundColor;
        border-radius: 9999px;
        border: 7px solid rgba(0, 0, 0, 0);
        background: var(--scrollbar-bg-color);
        background-clip: padding-box;
        min-height: 50px;

        &:hover {
            background: var(--scrollbar-bg-color__hover);
            background-clip: padding-box;
        }
    }
}
</style>
