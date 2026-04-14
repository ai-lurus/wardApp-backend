import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { registry, UserSchema } from "../lib/openapi";

const router = Router();

// Schemas para OpenAPI
const AuthResponseSchema = registry.register(
  "AuthResponse",
  z.object({
    token: z.string(),
    user: UserSchema,
  })
);

// Documentación de rutas
registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Iniciar sesión",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email().openapi({ example: "admin@ward.io" }),
            password: z.string().min(1).openapi({ example: "password123" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login exitoso",
      content: { "application/json": { schema: AuthResponseSchema } },
    },
    401: { description: "Credenciales inválidas" },
  },
});

const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await authService.login(body.email, body.password);
      
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days (matches env)
      });
      
      res.json({ token: result.token, user: result.user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Refrescar token de acceso",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Nuevo token generado",
      content: { "application/json": { schema: z.object({ token: z.string() }) } },
    },
    401: { description: "Refresh token inválido o expirado" },
  },
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) throw new AppError(401, "No refresh token provided");

    const result = await authService.processRefreshToken(token);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ token: result.token });
  } catch (err) {
    next(err);
  }
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Cerrar sesión",
  tags: ["Auth"],
  responses: {
    200: {
      description: "Sesión cerrada exitosamente",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});

router.post("/logout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "Obtener información del usuario actual",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Datos del usuario",
      content: { "application/json": { schema: UserSchema } },
    },
    401: { description: "No autorizado" },
  },
});

router.get(
  "/me",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.userId, req.user!.companyId);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

registry.registerPath({
  method: "patch",
  path: "/auth/change-password",
  summary: "Cambiar contraseña",
  tags: ["Auth"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(6),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Contraseña cambiada exitosamente",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

router.patch(
  "/change-password",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await authService.changePassword(req.user!.userId, req.user!.companyId, currentPassword, newPassword);
      res.json({ message: "Contraseña actualizada" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "post",
  path: "/auth/forgot-password",
  summary: "Solicitar recuperación de contraseña",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ email: z.string().email() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Enlace enviado si el correo existe",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});

const forgotPasswordSchema = z.object({
  email: z.email("Email inválido"),
});

router.post(
  "/forgot-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const baseUrl = `${req.protocol}://${req.get("host")}`.replace(
        /:3001$/,
        ":3000"
      );
      await authService.forgotPassword(email, baseUrl);
      // Always 200 to avoid email enumeration
      res.json({ message: "Si el correo existe, recibirás un enlace en breve" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  summary: "Restablecer contraseña con token",
  tags: ["Auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            newPassword: z.string().min(6),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Contraseña restablecida exitosamente",
      content: { "application/json": { schema: z.object({ message: z.string() }) } },
    },
  },
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "El token es requerido"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

router.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(token, newPassword);
      res.json({ message: "Contraseña actualizada exitosamente" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const message = err.issues.map((e: any) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(err);
      }
    }
  }
);

export { router as authRoutes };
