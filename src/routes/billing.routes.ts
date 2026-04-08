import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import * as stripeService from "../services/stripe.service";
import { env } from "../config/env";
import Stripe from "stripe";

const router = Router();

const checkoutSchema = z.object({
    modules: z.array(z.string()).default(["inventario"]),
    returnUrl: z.url(),
});

router.post(
    "/create-checkout-session",
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { modules, returnUrl } = checkoutSchema.parse(req.body);

            const company = await prisma.company.findUnique({
                where: { id: req.user!.companyId }
            });

            if (!company) throw new AppError(404, "Company not found");

            // If they already have a customer ID, they should use Customer Portal
            if (company.stripe_customer_id) {
                const url = await stripeService.createCustomerPortalSession(
                    company.stripe_customer_id,
                    returnUrl
                );
                return res.json({ url });
            }

            const url = await stripeService.createCheckoutSession(
                company.id,
                modules,
                `${returnUrl}?status=success`,
                `${returnUrl}?status=cancel`
            );

            res.json({ url });
        } catch (err) {
            next(err);
        }
    }
);

const portalSchema = z.object({
    returnUrl: z.url(),
});

router.post(
    "/create-portal-session",
    authMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { returnUrl } = portalSchema.parse(req.body);

            const company = await prisma.company.findUnique({
                where: { id: req.user!.companyId }
            });

            if (!company || !company.stripe_customer_id) {
                throw new AppError(400, "No active subscription/customer found");
            }

            const url = await stripeService.createCustomerPortalSession(
                company.stripe_customer_id,
                returnUrl
            );

            res.json({ url });
        } catch (err) {
            next(err);
        }
    }
);

// Note: Stripe Webhooks need raw body, so you must mount a raw body parser specifically for this route in app.ts
// Usually: app.post('/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);
router.post(
    "/webhook",
    async (req: Request, res: Response, next: NextFunction) => {
        const rawBody = req.body; // Needs to be raw buffer
        const sig = req.headers['stripe-signature'] as string;

        if (!env.STRIPE_WEBHOOK_SECRET || !stripeService.stripe) {
            return res.status(400).send("Stripe not configured.");
        }

        try {
            const event = stripeService.stripe.webhooks.constructEvent(
                rawBody,
                sig,
                env.STRIPE_WEBHOOK_SECRET
            );

            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const companyId = session.client_reference_id;
                    const customerId = session.customer as string;
                    const subscriptionId = session.subscription as string;
                    const assignedModules = session.metadata?.modules?.split(",") || ["inventario"];

                    if (companyId) {
                        await prisma.company.update({
                            where: { id: companyId },
                            data: {
                                stripe_customer_id: customerId,
                                stripe_subscription_id: subscriptionId,
                                subscription_status: "active",
                                active_modules: assignedModules as import("@prisma/client").AppModule[],
                            },
                        });
                    }
                    break;
                }
                case "customer.subscription.deleted":
                case "customer.subscription.updated": {
                    const subscription = event.data.object as Stripe.Subscription;
                    const customerId = subscription.customer as string;
                    const status = subscription.status;

                    const company = await prisma.company.findFirst({
                        where: { stripe_customer_id: customerId }
                    });

                    if (company) {
                        const isActive = status === "active" || status === "trialing";
                        await prisma.company.update({
                            where: { id: company.id },
                            data: {
                                subscription_status: status,
                                stripe_subscription_id: subscription.id,
                                // Revoke paid modules when subscription is no longer active
                                active_modules: (isActive ? company.active_modules : ["inventario"]) as import("@prisma/client").AppModule[],
                            }
                        });
                    }
                    break;
                }
                case "invoice.payment_failed": {
                    const invoice = event.data.object as Stripe.Invoice;
                    const customerId = invoice.customer as string;

                    const company = await prisma.company.findFirst({
                        where: { stripe_customer_id: customerId }
                    });

                    if (company) {
                        await prisma.company.update({
                            where: { id: company.id },
                            data: { subscription_status: "past_due" }
                        });
                    }
                    break;
                }
            }

            res.json({ received: true });
        } catch (err: any) {
            console.error(`Webhook Error: ${err.message}`);
            // Usually webhook errors should return 400
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }
);

export { router as billingRoutes };
