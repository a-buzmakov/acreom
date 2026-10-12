import { Context } from '@nuxt/types';

export class AccessControl {
    private context: Context;

    constructor(ctx: Context) {
        this.context = ctx;
    }

    get hasProAccess() {
        if (this.context.$config.hasPro) {
            return true;
        }
        return this.context.store.getters['user/subscriptionActive'];
    }

    get isProActive() {
        if (this.context.$config.hasPro) {
            return true;
        }
        const isActive = this.context.store.getters['user/subscriptionActive'];
        const subscription = this.context.store.getters['user/subscription'];

        return subscription?.type === 'pro' && isActive;
    }

    get isTrialActive() {
        const isActive = this.context.store.getters['user/subscriptionActive'];
        const subscription = this.context.store.getters['user/subscription'];

        return subscription?.type === 'trial' && isActive;
    }

    get subscriptionExpired() {
        if (this.context.$config.hasPro) {
            return false;
        }
        return (
            this.context.store.getters['user/subscriptionExpired'] ||
            ['canceled', 'past_due'].includes(
                this.context.store.getters['user/subscription']?.status,
            )
        );
    }

    get readOnlyAccess() {
        if (this.context.$config.hasPro) {
            return false;
        }
        return (
            !this.context.store.getters['vault/isActiveLocal'] &&
            this.subscriptionExpired
        );
    }

    readOnlyDeny() {
        // Self-hosted: Pro is always unlocked; do not open paywall.
    }

    get subscribeLink() {
        const user = this.context.store.getters['user/user'];
        const billingOption =
            this.context.store.getters['misc/billingOption'] || 'monthly';
        if (billingOption === 'yearly') {
            return `${this.context.$config.billingURL.yearly}?client_reference_id=${user?.id}&prefilled_email=${user?.email}`;
        } else {
            return `${this.context.$config.billingURL.monthly}?client_reference_id=${user?.id}&prefilled_email=${user?.email}`;
        }
    }

    showProModal() {
        // Self-hosted: Pro is always unlocked; do not open paywall.
    }
}
