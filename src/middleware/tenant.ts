import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  // MVP: hardcoded to demo tenant
  req.tenantId = "demo";
  next();
}
