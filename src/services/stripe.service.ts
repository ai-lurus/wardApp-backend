import Stripe from 'stripe';
import { env } from '../config/env';

export const stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as any })
    : null;

export const createCheckoutSession = async (
    companyId: string,
    modules: string[],
    successUrl: string,
    cancelUrl: string
) => {
    if (!stripe) throw new Error('Stripe is not configured');

    // Typically, you would map "modules" to specific Stripe Price IDs.
    // For the MVP, we just create a standard subscription or a dummy price.
    // In a real scenario, map "modules" array to line_items.
    const lineItems = modules.map(() => ({
        price_data: {
            currency: 'usd',
            product_data: { name: 'Suscripción Ward App' },
            unit_amount: 5000, // $50.00
            recurring: { interval: 'month' as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval },
        },
        quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        client_reference_id: companyId,
        metadata: { companyId, modules: modules.join(',') },
        line_items: lineItems.length > 0 ? lineItems : [
            {
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Módulo Base' },
                    unit_amount: 3000,
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }
        ],
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
