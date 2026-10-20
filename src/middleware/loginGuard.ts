import { Request, Response, NextFunction } from "express";
import * as securityService from "../services/security.service";

export const loginGuard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "0.0.0.0";
    if (ip.includes(",")) {
      ip = ip.split(",")[0].trim();
    }
    const email = req.body.email;

    if (!email || typeof email !== "string") {
      return next(); // Zod se encargará de rechazarlo
    }

    const { isLocked, remainingSeconds } = await securityService.checkLockStatus(ip, email);

    if (isLocked) {
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Intenta nuevamente en ${remainingSeconds} segundos.`
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
