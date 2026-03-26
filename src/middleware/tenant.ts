import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Verifies the company has an active subscription and the given module enabled.
 * Must be used after authMiddleware.
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

            const hasActiveSubscription = ACTIVE_STATUSES.has(company.subscription_status ?? "");
            const hasModule = company.active_modules.includes(moduleId);

            if (!hasActiveSubscription || !hasModule) {
                return res.status(403).json({
                    error: "Tu plan no incluye este módulo. Actualiza tu suscripción.",
                    code: "SUBSCRIPTION_REQUIRED",
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
