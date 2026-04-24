import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as tripService from "../services/trip.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { TripStatus } from "@prisma/client";
import { registry } from "../lib/openapi";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const tripStatusEnum = z.nativeEnum(TripStatus).openapi("TripStatus");

const TripCostDetailSchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  tollbooth_cost: z.number(),
  fuel_cost: z.number(),
  fuel_type: z.string().nullable(),
  extras_cost: z.number(),
  estimated_tollbooth_cost: z.number(),
  estimated_fuel_cost: z.number(),
  estimated_extras_cost: z.number(),
});

const TripSchema = registry.register(
  "Trip",
  z.object({
    id: z.string().uuid(),
    company_id: z.string().uuid(),
    route_id: z.string().uuid(),
    unit_id: z.string().uuid(),
    operator_id: z.string().uuid(),
    status: tripStatusEnum,
    scheduled_date: z.date(),
    departure_time: z.date().nullable(),
    arrival_time: z.date().nullable(),
    estimated_cost: z.number().nullable(),
    actual_cost: z.number().nullable(),
    notes: z.string().nullable(),
    entry_cost: z.number().nullable(),
    created_at: z.date(),
    updated_at: z.date(),
    cost_detail: TripCostDetailSchema.optional(),
  })
);

const createTripSchema = z.object({
  route_id: z.string().uuid("El ID de la ruta no es un UUID válido"),
  unit_id: z.string().uuid("El ID de la unidad no es un UUID válido"),
  operator_id: z.string().uuid("El ID del operador no es un UUID válido"),
  scheduled_date: z.string().datetime("La fecha programada debe ser una fecha válida ISO"),
  notes: z.string().optional(),
  entry_cost: z.number().optional(),
  tollbooth_cost: z.number().optional(),
  fuel_cost: z.number().optional(),
  extras_cost: z.number().optional(),
  estimated_tollbooth_cost: z.number().optional(),
  estimated_fuel_cost: z.number().optional(),
  estimated_extras_cost: z.number().optional(),
  fuel_type: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: tripStatusEnum,
  actual_tollbooth_cost: z.number().optional(),
  actual_fuel_cost: z.number().optional(),
  actual_extras_cost: z.number().optional(),
  entry_cost: z.number().optional()
});

const getTripsQuerySchema = z.object({
  status: tripStatusEnum.optional(),
  route_id: z.string().uuid().optional(),
  operator_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid("El ID del viaje no es un UUID válido"),
});

registry.registerPath({
  method: "get",
  path: "/trips",
  summary: "Listar viajes",
  tags: ["Trips"],
  security: [{ bearerAuth: [] }],
  request: {
    query: getTripsQuerySchema,
  },
  responses: {
    200: {
      description: "Lista de viajes",
      content: {
        "application/json": {
          schema: z.array(TripSchema),
        },
      },
    },
  },
});

// GET /api/trips
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = getTripsQuerySchema.parse(req.query);
    const trips = await tripService.getTrips(req.user!.companyId, filters);
    res.json(trips);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "get",
  path: "/trips/{id}",
  summary: "Obtener viaje por ID",
  tags: ["Trips"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Detalle del viaje",
      content: {
        "application/json": {
          schema: TripSchema,
        },
      },
    },
    404: { description: "Viaje no encontrado" },
  },
});

// GET /api/trips/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const trip = await tripService.getTripById(req.user!.companyId, id);
    res.json(trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "post",
  path: "/trips",
  summary: "Crear un nuevo viaje",
  tags: ["Trips"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createTripSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Viaje creado con éxito",
      content: {
        "application/json": {
          schema: TripSchema,
        },
      },
    },
    400: { description: "Error de validación o recurso no disponible" },
  },
});

// POST /api/trips
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTripSchema.parse(req.body);
    const trip = await tripService.createTrip(req.user!.companyId, body);
    res.status(201).json(trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

registry.registerPath({
  method: "patch",
  path: "/trips/{id}/status",
  summary: "Actualizar estatus de un viaje",
  tags: ["Trips"],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Estatus actualizado con éxito",
      content: {
        "application/json": {
          schema: TripSchema,
        },
      },
    },
    404: { description: "Viaje no encontrado" },
  },
});

// PATCH /api/trips/:id/status
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const body = updateStatusSchema.parse(req.body);
    const trip = await tripService.updateTripStatus(req.user!.companyId, id, body);
    res.json(trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: any) => e.message).join(", ");
      next(new AppError(400, message));
    } else {
      next(err);
    }
  }
});

export { router as tripRoutes };
