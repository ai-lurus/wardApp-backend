import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("24h"),
  PORT: z.coerce.number().default(3001),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default("noreply@wardapp.com.mx"),
});

export const env = envSchema.parse(process.env);
