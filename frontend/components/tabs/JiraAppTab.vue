<template>
    <div class="jira" @mousedown="$emit('focus-tab')">
        <div class="jira--content">
            <div class="jira--content--issues">
                <JiraView />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { transition } from '~/helpers/util';
import JiraView from '~/components/integrations/jira/JiraView.vue';
import TabMixin from '~/components/tabs/TabMixin.vue';

@Component({
    name: 'DocumentsIndex',
    components: {
        JiraView,
    },
    transition,
})
export default class JiraAppTab extends TabMixin<any> {
    registerShortcuts() {
        this.$shortcutsManager.enableNamespace('jira');
    }

    removeShortcuts() {
        this.$shortcutsManager.disableNamespace('jira');
    }

    mounted() {
        this.registerShortcuts();
    }

    beforeDestroy() {
        this.removeShortcuts();
    }

    updateGroupData(data: Partial<any>) {
        const groupDataProperties = [
            'collapsed',
            'selectedDisplayProperties',
            'orderAscending',
            'filterByAssignee',
        ];
        const groupData = groupDataProperties.reduce((acc: any, key: any) => {
            if (key in data) {
                acc[key] = data[key];
            }
            return acc;
        }, {} as any);
        if (!Object.keys(groupData).length) return;
        this.$tabs.updateGroupData(this.groupId, this.entityId, groupData);
    }
}
</script>

<style scoped lang="scss">
.jira {
    height: $desktopContentHeight;

    &--content {
        position: relative;
        height: 100%;

        &--issues {
            @include scrollbar;
            position: relative;
            z-index: 1;
            overflow-y: overlay;
            height: 100%;
            width: 100%;
        }
    }
}
</style>
