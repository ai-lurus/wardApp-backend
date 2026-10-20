import { Request, Response, NextFunction } from "express";
import { AppModule } from "@prisma/client";
import { prisma } from "../lib/prisma";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Maps a module id to the error code the gate returns when that module
// is missing from the tenant's `active_modules`. Warden callers (and the
// warden contract) key off `WARDEN_MODULE_DISABLED` specifically; other
// modules use a uniform `{MODULE}_MODULE_DISABLED` derived code.
function moduleDisabledCode(moduleId: string): string {
    return `${moduleId.toUpperCase()}_MODULE_DISABLED`;
}

/**
 * Verifies the company has an active subscription AND the given module
 * enabled. Must be used after authMiddleware so `req.user.companyId` is
 * set. Distinguishes two failure modes so the client can react
 * differently:
 *
 *   • `SUBSCRIPTION_REQUIRED` — billing is not active (paused, canceled,
 *     past_due). Client should route the user to the billing portal.
 *   • `{MODULE}_MODULE_DISABLED` — billing is fine but the tenant has
 *     not enabled this module. Client should show an "upgrade module"
 *     upsell, not a generic billing banner. For the Warden module the
 *     code is `WARDEN_MODULE_DISABLED` (per contracts/warden-api.md).
 */
export const checkModuleAccess = (moduleId: string) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const company = await prisma.company.findUnique({
                where: { id: req.user!.companyId },
                select: { subscription_status: true, active_modules: true },
            });

            if (!company) {
                return res.status(403).json({ error: "Empresa no encontrada" });
            }

            const hasActiveSubscription = ACTIVE_STATUSES.has(
                company.subscription_status ?? ""
            );
            if (!hasActiveSubscription) {
                return res.status(403).json({
                    error: "Tu suscripción no está activa. Actualiza tu plan para continuar.",
                    code: "SUBSCRIPTION_REQUIRED",
                });
            }

            const hasModule = company.active_modules.includes(moduleId as AppModule);
            if (!hasModule) {
                return res.status(403).json({
                    error: "Tu plan no incluye este módulo. Actualiza tu suscripción.",
                    code: moduleDisabledCode(moduleId),
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
