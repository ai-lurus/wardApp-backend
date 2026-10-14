import { withTenant } from "../lib/prisma";
import { Prisma, TripStatus, UnitStatus, OperatorStatus } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export interface TripFilters {
  status?: TripStatus;
  route_id?: string;
  operator_id?: string;
  unit_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface CreateTripDto {
  route_id: string;
  unit_id: string;
  operator_id: string;
  scheduled_date: string;
  notes?: string;
  entry_cost?: number;
  tollbooth_cost?: number;
  fuel_cost?: number;
  extras_cost?: number;
  estimated_tollbooth_cost?: number;
  estimated_fuel_cost?: number;
  estimated_extras_cost?: number;
  fuel_type?: string;
}

export async function createTrip(companyId: string, data: CreateTripDto) {
  return withTenant(companyId, async (tx) => {
    // 1. Verify Unit is disponible
    const unit = await tx.unit.findFirst({
      where: { id: data.unit_id, company_id: companyId },
    });
    if (!unit) throw new AppError(404, "Unidad no encontrada");
    if (unit.status !== UnitStatus.disponible) {
      throw new AppError(400, "La unidad seleccionada no está disponible");
    }

    // 2. Verify Operator is disponible
    const operator = await tx.operator.findFirst({
      where: { id: data.operator_id, company_id: companyId },
    });
    if (!operator) throw new AppError(404, "Operador no encontrado");
    if (operator.status !== OperatorStatus.disponible) {
      throw new AppError(400, "El operador seleccionado no está disponible");
    }

    // 3. Verify Route
    const route = await tx.route.findFirst({
      where: { id: data.route_id, company_id: companyId },
    });
    if (!route) throw new AppError(404, "Ruta no encontrada");

    const estimated_tollbooth_cost = data.estimated_tollbooth_cost || 0;
    const estimated_fuel_cost = data.estimated_fuel_cost || 0;
    const estimated_extras_cost = data.estimated_extras_cost || 0;

    const tollbooth_cost = data.tollbooth_cost || 0;
    const fuel_cost = data.fuel_cost || 0;
    const extras_cost = data.extras_cost || 0;

    const estimated_cost = estimated_tollbooth_cost + estimated_fuel_cost + estimated_extras_cost;
    const actual_cost = tollbooth_cost + fuel_cost + extras_cost;

    // Change statuses
    await tx.unit.update({
      where: { id: data.unit_id },
      data: { status: UnitStatus.en_viaje },
    });

    await tx.operator.update({
      where: { id: data.operator_id },
      data: { status: OperatorStatus.en_viaje },
    });

    // Create trip
    return tx.trip.create({
      data: {
        company_id: companyId,
        route_id: data.route_id,
        unit_id: data.unit_id,
        operator_id: data.operator_id,
        scheduled_date: new Date(data.scheduled_date),
        notes: data.notes,
        entry_cost: data.entry_cost,
        estimated_cost,
        actual_cost,
        status: TripStatus.programado,
        cost_detail: {
          create: {
            tollbooth_cost,
            fuel_cost,
            extras_cost,
            estimated_tollbooth_cost,
            estimated_fuel_cost,
            estimated_extras_cost,
            fuel_type: data.fuel_type,
          }
        }
      },
      include: {
        cost_detail: true,
        route: true,
        unit: true,
        operator: true,
      }
    });
  });
}

export async function getTrips(companyId: string, filters: TripFilters) {
  return withTenant(companyId, async (tx) => {
    const where: Prisma.TripWhereInput = {
      company_id: companyId,
    };

    if (filters.status) where.status = filters.status;
    if (filters.route_id) where.route_id = filters.route_id;
    if (filters.operator_id) where.operator_id = filters.operator_id;
    if (filters.unit_id) where.unit_id = filters.unit_id;

    if (filters.from_date || filters.to_date) {
      where.scheduled_date = {};
      if (filters.from_date) where.scheduled_date.gte = new Date(filters.from_date);
      if (filters.to_date) where.scheduled_date.lte = new Date(filters.to_date);
    }

    return tx.trip.findMany({
      where,
      include: {
        route: true,
        unit: true,
        operator: true,
        cost_detail: true,
      },
      orderBy: { scheduled_date: "desc" },
    });
  });
}

export async function getTripById(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id, company_id: companyId },
      include: {
        route: true,
        unit: true,
        operator: true,
        cost_detail: true,
      },
    });

    if (!trip) throw new AppError(404, "Viaje no encontrado");
    return trip;
  });
}

export interface UpdateTripStatusDto {
  status: TripStatus;
}

export async function updateTripStatus(companyId: string, tripId: string, data: UpdateTripStatusDto) {
  return withTenant(companyId, async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, company_id: companyId },
      include: { cost_detail: true }
    });

    if (!trip) throw new AppError(404, "Viaje no encontrado");

    if (data.status === TripStatus.completado) {
      throw new AppError(400, "Estatus no permitido. Para completar el viaje, utiliza el endpoint /api/trips/:id/complete");
    }

    // Free unit and operator if transitioning to completado or cancelado
    if (data.status === TripStatus.cancelado) {
      if (trip.status !== TripStatus.cancelado) {
        await tx.unit.update({
          where: { id: trip.unit_id },
          data: { status: UnitStatus.disponible }
        });
        await tx.operator.update({
          where: { id: trip.operator_id },
          data: { status: OperatorStatus.disponible }
        })
      }
    }

    const updateData: Prisma.TripUpdateInput = {
      status: data.status,
    };

    if (data.status === TripStatus.en_curso) {
      updateData.departure_time = new Date();
    }



    return tx.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        cost_detail: true,
        route: true,
        unit: true,
        operator: true,
      }
    });
  });
}

export interface CompleteTripDto {
  actual_tollbooth_cost: number;
  actual_fuel_cost: number;
  actual_extras_cost: number;
  entry_cost: number;
}
export async function completeTrip(companyId: string, tripId: string, data: CompleteTripDto) {
  return withTenant(companyId, async (tx) => {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, company_id: companyId },
      include: { cost_detail: true }
    });

    if (!trip) throw new AppError(404, "Viaje no encontrado");

    // Free unit and operator if transitioning to completado or cancelado
    if (trip.status === TripStatus.completado || trip.status === TripStatus.cancelado) {
      throw new AppError(400, "El viaje ya se encuentra completado o cancelado");
    }
    const tollbooth_cost = data.actual_tollbooth_cost;
    const fuel_cost = data.actual_fuel_cost;
    const extras_cost = data.actual_extras_cost;
    const actual_cost = tollbooth_cost + fuel_cost + extras_cost;

    const updateData: Prisma.TripUpdateInput = {
      status: TripStatus.completado,
      actual_cost,
      arrival_time: new Date(),
      entry_cost: data.entry_cost,
      cost_detail: {
        update: {
          tollbooth_cost,
          fuel_cost,
          extras_cost,
        }
      }
    };

    await tx.unit.update({
      where: { id: trip.unit_id },
      data: { status: UnitStatus.disponible }
    });

    await tx.operator.update({
      where: { id: trip.operator_id },
      data: { status: OperatorStatus.disponible }
    });
    return tx.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        cost_detail: true,
        unit: true,
        operator: true,
      }
    });
  });
}


