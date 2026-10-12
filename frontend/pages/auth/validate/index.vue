<template>
    <div class="validate">
        <div v-if="redirect" class="backdrop normal-browser"></div>
        <div v-if="redirect" class="web-wrapper">
            <img
                src="/favicons/production/android-chrome-512x512.png"
                alt="acreom logo"
            />
            <h2>Signing in...</h2>
            <button v-if="redirect" @click="openInAcreom">Open acreom</button>
        </div>
        <div v-else class="loader-wrapper">
            <LoadingIcon class="icon" size="30" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { isElectron } from '~/helpers/is-electron';
import { SafeElectronWindow } from '~/@types';
import { DatabaseServiceAction, ServiceKey } from '~/constants';
import { isDatabaseService } from '~/plugins/workers/database';
import LoadingIcon from '~/components/icons/LoadingIcon.vue';

@Component({
    layout: 'auth',
    components: { LoadingIcon },
    transition: {
        name: 'validate',
        mode: 'out-in',
    },
})
export default class Validate extends Vue {
    redirect: boolean = false;

    openInAcreom() {
        const { access_token, device_refresh_token, expires_at } =
            this.$route.query;

        const redirectUrl =
            'redirect:' +
            this.$route.path +
            `?access_token=${access_token}&refresh_token=${device_refresh_token}&expires_at=${expires_at}`;

        if (isElectron()) {
            (window as SafeElectronWindow).electron.login({
                access_token: access_token as string,
                refresh_token: device_refresh_token as string,
                expires_at: expires_at as string,
            });
        } else {
            // call deeplink
            window.location.replace(`acreom://${btoa(redirectUrl)}`);
        }
    }

    async mounted() {
        try {
            const {
                access_token,
                refresh_token,
                device_refresh_token,
                strategy,
                expires_at,
                context,
            } = this.$route.query;

            // This is very likely open in browser and should log in the user in desktop app
            if (strategy && strategy.includes('device')) {
                // If it is web, track user to analytics
                if (this.$config.platform === 'web') {
                    if ((window as any).twq) {
                        (window as any).twq('event', 'tw-oczdv-oec5p', {});
                    }

                    try {
                        const { data } = await this.$cloudService.User.retrieve(
                            access_token as string,
                        );

                        if (data.id) {
                            this.$tracking.identifyUser(data);
                            this.$tracking.identifyApp();
                        }
                    } catch (error) {
                        console.log(error);
                        this.$sentry.captureException(error);
                    }
                }
                this.redirect = true;
                this.openInAcreom();

                return;
            }

            if (strategy && strategy.includes('pricing')) {
                if (this.$config.platform === 'web' && (window as any).twq) {
                    (window as any).twq('event', 'tw-oczdv-oec5p', {});
                }

                this.redirect = true;
                const redirectUrl =
                    'redirect:' +
                    this.$route.path +
                    `?access_token=${access_token}&refresh_token=${device_refresh_token}&strategy=login-pay`;

                window.location.replace(`acreom://${btoa(redirectUrl)}`);
                return;
            }

            if (this.$store.getters['auth/loggedIn']) {
                this.$router.push('/');
                return;
            }

            let expiresAt;
            try {
                expiresAt = parseInt(expires_at as string, 10);
            } catch (e) {
                expiresAt = null;
            }

            const credentials = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt,
            };
            await this.$serviceRegistry.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.INITIALIZE_USER,
                {
                    payload: credentials,
                    callerContext:
                        'auth/validate/index.vue initialize user mounted',
                },
            );

            const database = this.$serviceRegistry.service(ServiceKey.DATABASE);
            let redirectCallback = () => Promise.resolve();
            if (isDatabaseService(database)) {
                redirectCallback = () =>
                    new Promise<void>(resolve => {
                        database.once('protocol-loaded', async () => {
                            resolve();
                            await this.$store.dispatch(
                                'initializeAndRedirect',
                                { waitForProtocol: false, context },
                            );
                        });
                    });
            }

            await this.$store.dispatch('auth/storeCredentials', credentials);
            await this.$store.dispatch('auth/fetchUser');

            const loggedIn = this.$store.getters['auth/loggedIn'];

            if (!loggedIn) return;

            if (isElectron() && this.$config.os === 'linux') {
                (window as SafeElectronWindow).electron.closeExternalLogin();
            }

            if (this.$config.platform === 'web' && (window as any).twq) {
                (window as any).twq('event', 'tw-oczdv-oec5p', {});
            }

            await redirectCallback();
        } catch (error) {
            console.log(error);
            this.$sentry.captureException(error);
            this.$router.push('/auth/login');
        }
    }
}
</script>

<style lang="scss" scoped>
.validate {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.backdrop {
    position: absolute;
    height: 616px;
    width: 100%;
    top: 0px;
    z-index: 1;
    background-image: url('/backdrop/backdrop.webp');
    background-repeat: no-repeat;
    background-position: top center;
    background-size: cover;
    pointer-events: none;
}

.web-wrapper {
    img {
        display: block;
        max-width: 110px;
        margin: 0 auto 30px;
    }

    h2 {
        font-size: 20px;
        margin-bottom: 40px;
    }

    button {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        @include font14-500;
        background: $white;
        width: 100%;
        padding: 13px 130px;
        border-radius: 8px;
        color: $black;
    }
}

.loader-wrapper {
    .icon {
        color: var(--loading-icon-color);
        margin: 0 auto;
    }
}

h2 {
    @include font14-500;
    color: var(--validate-heading-text-color);
    margin-top: 15px;
    text-align: center;
    width: 100%;
}

#loader {
    max-width: 120px;
    width: 100%;
    opacity: 1;
    margin: 0 auto;
}
</style>
