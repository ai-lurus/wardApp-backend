import { OpenAPIRegistry, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extender Zod con funcionalidad OpenAPI
extendZodWithOpenApi(z);

/**
 * Registro central de OpenAPI para coleccionar definiciones de rutas y componentes.
 */
export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

export const UserSchema = registry.register(
  "User",
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: z.string(),
    companyId: z.string().uuid(),
    active: z.boolean().optional(),
  })
);
