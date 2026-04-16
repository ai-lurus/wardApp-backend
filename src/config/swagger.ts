import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../lib/openapi";

/**
 * Genera la especificación OpenAPI basada en el registro central.
 */
export function generateSwaggerSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Ward.io API Documentation",
      description: "API para el sistema de gestión de transporte Ward.io (Multitenant)",
    },
    servers: [{ url: "/api" }],
    security: [{ bearerAuth: [] }],
  });
}
