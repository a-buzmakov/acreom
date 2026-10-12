<template>
    <div class="github-tab">
        <div class="github-tab--content">
            <div class="github-tab--content--issues">
                <LinearView />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import LinearView from '~/components/linear/app/LinearView.vue';
import TabMixin from '~/components/tabs/TabMixin.vue';

@Component({
    name: 'LinearAppTab',
    components: { LinearView },
})
export default class LinearAppTab extends TabMixin<any> {
    updateGroupData(data: Partial<any>) {
        const groupDataProperties = [
            'filters',
            'team',
            'displayProperties',
            'sortBy',
            'groupBy',
            'lastSearchResults',
            'lastQuery',
            'activeTab',
            'collapsedGroups',
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

    registerShortcuts() {
        this.$shortcutsManager.enableNamespace('linear');
    }

    removeShortcuts() {
        this.$shortcutsManager.disableNamespace('linear');
    }
}
</script>
<style lang="scss" scoped>
.github-tab {
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
