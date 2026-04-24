import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as tripService from "../services/trip.service";
import { authMiddleware } from "../middleware/auth";
import { checkModuleAccess } from "../middleware/tenant";
import { AppError } from "../middleware/errorHandler";
import { TripStatus } from "@prisma/client";

const router = Router();
router.use(authMiddleware);
router.use(checkModuleAccess("operaciones"));

const tripStatusEnum = z.nativeEnum(TripStatus);

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
