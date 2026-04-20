import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env.test") });

import { z } from "zod";

const envSchema = z.object({
  // Entorno de ejecución
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  
  // Base de datos y Auth
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  
  // Servidor
  PORT: z.coerce.number().default(3001),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  
  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default("noreply@wardapp.com.mx"),
  
  // Pagos (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Google Cloud Storage
  GCS_PROJECT_ID: z.string().optional(),
  GCS_CLIENT_EMAIL: z.string().optional(),
  GCS_PRIVATE_KEY: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),

  // Warden (Anthropic)
  ANTHROPIC_API_KEY: z.string().optional(),
  WARDEN_MODEL: z.string().default("claude-sonnet-4-5"),
}).refine((data) => {
  // Regla de Seguridad: Si estamos en producción o staging, el JWT_SECRET
  // NO debe ser el valor por defecto de desarrollo.
  if (data.NODE_ENV === "production" || data.NODE_ENV === "staging") {
    return data.JWT_SECRET !== "ward-dev-secret-change-in-production";
  }
  return true;
}, {
  message: "CRÍTICO: Debes cambiar JWT_SECRET por una clave segura antes de desplegar a Staging/Producción.",
  path: ["JWT_SECRET"]
});

export const env = envSchema.parse(process.env);
