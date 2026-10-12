<template>
    <div class="success-page">
        <div class="success-page--container">
            <div class="success-page--container--container-content">
                <div id="pro-loader" ref="loader"></div>
                <h1 class="success-page--container--container-content--heading">
                    You're all set
                </h1>
                <h2
                    class="success-page--container--container-content--heading2"
                >
                    Open acreom to continue
                    {{ user ? ` as ${user.email}` : '' }}.
                </h2>
                <div
                    class="
                        success-page--container--container-content--navigation
                    "
                >
                    <button
                        v-if="!timedOut"
                        class="back-button"
                        :class="{ 'back-button--disabled': opening }"
                        :disabled="opening"
                        @click="openElectron"
                    >
                        {{ opening ? 'Opening ...' : 'Open in App' }}
                    </button>
                    <a
                        v-if="timedOut"
                        :href="primaryLink.link"
                        class="back-button"
                        >Download for {{ primaryLink.os }}</a
                    >
                    <p v-if="timedOut">
                        <span
                            v-for="(link, index) in secondaryLinks"
                            :key="link.os"
                        >
                            <a class="download-link" :href="link.link">{{
                                link.os
                            }}</a
                            ><span v-if="index !== secondaryLinks.length - 1"
                                >,
                            </span>
                        </span>
                        and
                        <nuxt-link
                            class="download-link"
                            :to="`${
                                $store.getters['auth/loggedIn']
                                    ? '/redirect'
                                    : '/auth/login'
                            }`"
                            >web.</nuxt-link
                        >
                    </p>

                    <p v-if="!timedOut">
                        <nuxt-link
                            class="download-link"
                            :to="`${
                                $store.getters['auth/loggedIn']
                                    ? '/redirect'
                                    : '/auth/login'
                            }`"
                            >or continue in browser.</nuxt-link
                        >
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({
    name: 'Success',
    components: {},
    layout: 'homepage',
})
export default class Success extends Vue {
    showAnimation: boolean = false;
    timedOut: boolean = false;
    opened: boolean = false;
    opening: boolean = false;

    get user() {
        return this.$store.getters['auth/user'];
    }

    async mounted() {
        const { default: lottie } = await import('lottie-web');
        const anim = lottie.loadAnimation({
            // @ts-ignore
            container: this.$refs.loader,
            renderer: 'svg',
            loop: false,
            autoplay: true,
            path: '/lottie/pro-reveal.json',
            rendererSettings: {
                progressiveLoad: false,
                hideOnTransparent: true,
            },
        });
        anim.addEventListener('data_ready', () => {
            this.showAnimation = true;
        });
        window.location.replace(this.appRedirect);
    }

    get appRedirect() {
        return `acreom://${btoa('redirect:/redirect')}`;
    }

    setTimedOut() {
        if (!this.opened) {
            this.opening = false;
            this.timedOut = true;
        }
    }

    openElectron() {
        this.opening = true;
        window.location.replace(this.appRedirect);
        window.onblur = () => {
            this.opening = false;
            this.opened = true;
        };
        window.onfocus = () => {
            this.opened = false;
        };
        setTimeout(this.setTimedOut, 5000);
    }

    get currentPlatform() {
        let os = 'other';
        if (navigator.appVersion.includes('Win')) os = 'windows';
        if (navigator.appVersion.includes('Mac')) os = 'mac';
        if (navigator.appVersion.includes('Linux')) os = 'linux';
        return os;
    }

    get windowsLink() {
        const version = this.$store.getters.latest;
        return `https://github.com/Acreom/releases/releases/download/v${version}/acreom-Setup-${version}.exe`;
    }

    get macosLink() {
        const version = this.$store.getters.latest;
        return `https://github.com/Acreom/releases/releases/download/v${version}/acreom-${version}.dmg`;
    }

    get linuxLink() {
        const version = this.$store.getters.latest;
        return `https://github.com/Acreom/releases/releases/download/v${version}/acreom-${version}.AppImage`;
    }

    get primaryLink() {
        if (this.currentPlatform === 'windows')
            return { os: 'Windows', link: this.windowsLink };
        if (this.currentPlatform === 'mac')
            return { os: 'MacOS', link: this.macosLink };
        if (this.currentPlatform === 'linux')
            return { os: 'Linux (AppImage)', link: this.linuxLink };

        return null;
    }

    get secondaryLinks() {
        const links = [
            { os: 'Windows', link: this.windowsLink, tracking: 'windows' },
            { os: 'MacOS', link: this.macosLink, tracking: 'mac' },
            {
                os: 'Linux (AppImage)',
                link: this.linuxLink,
                tracking: 'linux',
            },
        ];

        if (!this.primaryLink) return links;

        return links.filter(({ os }) => os !== this.primaryLink?.os);
    }
}
</script>

<style lang="scss" scoped>
.back-button {
    min-width: 130px;
    color: var(--success-back-button-text-color);
    background: var(--success-back-button-bg-color);

    &--disabled {
        opacity: 0.6;
    }
}

.success-page {
    @include scrollbar;
    font-family: 'Inter', sans-serif;
    user-select: none;
    &--container {
        height: max(300px, calc(100vh - 141px));
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        &--container-content {
            display: flex;
            flex-direction: column;
            align-items: center;

            #pro-loader {
                width: 144px;
                height: 144px;
            }

            &--heading {
                color: var(--auth-heading-color);
                font-size: 32px;
                font-weight: 700;
                text-align: center;
                width: 100%;
                margin-bottom: 27px;
            }
            &--heading2 {
                @include font12-500;
                width: 350px;
                color: var(--success-subheading-text-color);
                text-align: center;
                a {
                    color: var(--success-subheading-link-color);
                    cursor: default;
                    text-decoration: line-through;
                }
            }
            &--navigation {
                display: flex;
                align-items: center;
                flex-direction: column;
                margin-top: 24px;

                .back-button {
                    @include font12-600;
                    color: var(--success-back-button-text-color);
                    background: var(--success-back-button-bg-color);
                    padding: 7px 29px;
                    border-radius: 6px;
                    outline: none;
                    cursor: default;
                    &--disabled {
                        opacity: 0.6;
                    }
                }
                .download-link {
                    color: var(--success-download-text-color);
                    cursor: default;
                    &:hover {
                        text-decoration: underline;
                    }
                }
                p {
                    @include font12-400;
                    text-align: center;
                    color: var(--success-subheading-text-color);
                    margin-top: 23px;
                }
            }
        }
    }
}
</style>
