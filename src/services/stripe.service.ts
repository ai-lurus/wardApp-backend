import Stripe from 'stripe';
import { env } from '../config/env';

export const stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as any })
    : null;

// Map module IDs to their Stripe Price IDs
const MODULE_PRICE_IDS: Record<string, string> = {
    inventario: 'price_1TEkTEBsGIJ0ttMx1AzERkGE',
};

export const createCheckoutSession = async (
    companyId: string,
    modules: string[],
    successUrl: string,
    cancelUrl: string
) => {
    if (!stripe) throw new Error('Stripe is not configured');

    const lineItems = modules
        .filter((mod) => MODULE_PRICE_IDS[mod])
        .map((mod) => ({ price: MODULE_PRICE_IDS[mod], quantity: 1 }));

    if (lineItems.length === 0) {
        throw new Error('No hay módulos válidos para suscribir');
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        client_reference_id: companyId,
        metadata: { companyId, modules: modules.join(',') },
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
    });

    return session.url;
};

export const createCustomerPortalSession = async (customerId: string, returnUrl: string) => {
    if (!stripe) throw new Error('Stripe is not configured');

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });

    return portalSession.url;
};
