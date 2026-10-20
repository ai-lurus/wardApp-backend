import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as customerService from "../services/customer.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { requireRole } from "../middleware/role";
import { AppError } from "../middleware/errorHandler";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("clientes"));

// Schemas para OpenAPI
const CustomerStatsSchema = z.object({
  trip_count: z.number(),
  completed_count: z.number(),
  revenue: z.number(),
  cost: z.number(),
  profit: z.number(),
  margin: z.number(),
  last_trip_date: z.date().nullable(),
});

const CustomerSchema = registry.register(
  "Customer",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
    stats: CustomerStatsSchema.optional(),
  })
);

const CustomerReportSchema = z.object({
  items: z.array(
    CustomerStatsSchema.extend({
      customer_id: z.string().uuid(),
      name: z.string(),
      phone: z.string(),
      email: z.string().nullable(),
      active: z.boolean(),
    })
  ),
  totals: z.object({
    customers_with_trips: z.number(),
    trip_count: z.number(),
    completed_count: z.number(),
    revenue: z.number(),
    cost: z.number(),
    profit: z.number(),
    margin: z.number(),
  }),
});

const idParamSchema = z.object({
  id: z.string().uuid("El ID del cliente no es un UUID válido"),
});

const getCustomersQuerySchema = z.object({
  search: z.string().optional(),
});

const reportQuerySchema = z.object({
  from_date: z.string().datetime("La fecha inicial debe ser una fecha válida ISO").optional(),
  to_date: z.string().datetime("La fecha final debe ser una fecha válida ISO").optional(),
});

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  phone: z.string().trim().min(1, "El teléfono es requerido"),
  email: z.string().trim().email("El correo no es válido").optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
});

const updateCustomerSchema = createCustomerSchema.partial();

const handleError = (err: unknown, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    next(new AppError(400, err.issues.map((e) => e.message).join(", ")));
  } else {
    next(err);
  }
};

registry.registerPath({
  method: "get",
  path: "/customers",
  summary: "Listar clientes con sus estadísticas de viajes",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: { query: getCustomersQuerySchema },
  responses: {
    200: {
      description: "Lista de clientes",
      content: { "application/json": { schema: z.array(CustomerSchema) } },
    },
  },
});

// GET /api/customers
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = getCustomersQuerySchema.parse(req.query);
    const customers = await customerService.getCustomers(req.user!.companyId, filters);
    res.json(customers);
  } catch (err) {
    handleError(err, next);
  }
});

registry.registerPath({
  method: "get",
  path: "/customers/report",
  summary: "Reporte de viajes, ingresos y utilidad por cliente",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: { query: reportQuerySchema },
  responses: {
    200: {
      description: "Reporte por cliente ordenado por frecuencia",
      content: { "application/json": { schema: CustomerReportSchema } },
    },
  },
});

// GET /api/customers/report
router.get("/report", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = reportQuerySchema.parse(req.query);
    const report = await customerService.getCustomerReport(req.user!.companyId, filters);
    res.json(report);
  } catch (err) {
    handleError(err, next);
  }
});

registry.registerPath({
  method: "get",
  path: "/customers/{id}",
  summary: "Obtener cliente con finanzas y viajes",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Detalle del cliente",
      content: { "application/json": { schema: CustomerSchema } },
    },
    404: { description: "Cliente no encontrado" },
  },
});

// GET /api/customers/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const customer = await customerService.getCustomerById(req.user!.companyId, id);
    res.json(customer);
  } catch (err) {
    handleError(err, next);
  }
});

registry.registerPath({
  method: "post",
  path: "/customers",
  summary: "Registrar cliente",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: createCustomerSchema } } },
  },
  responses: {
    201: {
      description: "Cliente creado",
      content: { "application/json": { schema: CustomerSchema } },
    },
    400: { description: "Error de validación" },
    403: { description: "Solo administradores" },
  },
});

// POST /api/customers
router.post("/", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createCustomerSchema.parse(req.body);
    const customer = await customerService.createCustomer(req.user!.companyId, body);
    res.status(201).json(customer);
  } catch (err) {
    handleError(err, next);
  }
});

registry.registerPath({
  method: "put",
  path: "/customers/{id}",
  summary: "Actualizar cliente",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: updateCustomerSchema } } },
  },
  responses: {
    200: {
      description: "Cliente actualizado",
      content: { "application/json": { schema: CustomerSchema } },
    },
    404: { description: "Cliente no encontrado" },
  },
});

// PUT /api/customers/:id
router.put("/:id", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateCustomerSchema.parse(req.body);
    const customer = await customerService.updateCustomer(req.user!.companyId, id, body);
    res.json(customer);
  } catch (err) {
    handleError(err, next);
  }
});

registry.registerPath({
  method: "delete",
  path: "/customers/{id}",
  summary: "Eliminar cliente (borrado lógico)",
  tags: ["Customers"],
  security: [{ bearerAuth: [] }],
  request: { params: idParamSchema },
  responses: {
    204: { description: "Cliente eliminado" },
    404: { description: "Cliente no encontrado" },
  },
});

// DELETE /api/customers/:id
router.delete("/:id", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await customerService.deleteCustomer(req.user!.companyId, id);
    res.status(204).send();
  } catch (err) {
    handleError(err, next);
  }
});

export { router as customerRoutes };
