<template>
    <div class="github-tab" @mousedown="$emit('focus-tab')">
        <div class="github-tab--content">
            <div class="github-tab--content--issues">
                <GithubView />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Component } from 'vue-property-decorator';
import GithubView from '~/components/github/GithubView.vue';
import TabMixin from '~/components/tabs/TabMixin.vue';

@Component({
    name: 'GithubAppTab',
    components: { GithubView },
})
export default class GithubAppTab extends TabMixin<any> {}
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
