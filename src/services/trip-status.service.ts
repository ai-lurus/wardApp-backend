import { withTenant } from "../lib/prisma";
import { TripStatus, UnitStatus, OperatorStatus, Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export interface TransitionPayload {
  departure_time?: string | Date;
  arrival_time?: string | Date;
  actual_cost?: number;
  cancellation_reason?: string;
  tollbooth_cost?: number;
  fuel_cost?: number;
  extras_cost?: number;
}

/**
 * Valid transitions:
 * - programado -> en_curso
 * - en_curso -> completado
 * - en_curso -> cancelado
 * - programado -> cancelado
 */
const VALID_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.programado]: [TripStatus.en_curso, TripStatus.cancelado],
  [TripStatus.en_curso]: [TripStatus.completado, TripStatus.cancelado],
  [TripStatus.completado]: [],
  [TripStatus.cancelado]: [],
};

export async function transitionTripStatus(
  companyId: string,
  tripId: string,
  newStatus: TripStatus,
  actorId: string,
  payload?: TransitionPayload
) {
  return withTenant(companyId, async (tx) => {
    // 1. Get current trip
    const trip = await tx.trip.findFirst({
      where: { id: tripId, company_id: companyId },
      include: { cost_detail: true },
    });

    if (!trip) {
      throw new AppError(404, "Viaje no encontrado");
    }

    // 2. Validate transition
    const allowed = VALID_TRANSITIONS[trip.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(
        400,
        `Transición de estatus inválida: ${trip.status} -> ${newStatus}`
      );
    }

    const updateData: Prisma.TripUpdateInput = {
      status: newStatus,
    };

    const sideEffects: Promise<any>[] = [];

    // 3. Handle specific logic for each transition
    if (newStatus === TripStatus.en_curso) {
      // programado -> en_curso
      updateData.departure_time = payload?.departure_time
        ? new Date(payload.departure_time)
        : new Date();
    } else if (newStatus === TripStatus.completado) {
      // en_curso -> completado
      if (!payload?.actual_cost && payload?.actual_cost !== 0) {
        throw new AppError(400, "Se requiere el costo real para completar el viaje");
      }

      updateData.arrival_time = payload?.arrival_time
        ? new Date(payload.arrival_time)
        : new Date();
      updateData.actual_cost = payload.actual_cost;

      // Update cost detail breakdown if provided
      if (
        payload.tollbooth_cost !== undefined ||
        payload.fuel_cost !== undefined ||
        payload.extras_cost !== undefined
      ) {
        updateData.cost_detail = {
          update: {
            tollbooth_cost: payload.tollbooth_cost ?? 0,
            fuel_cost: payload.fuel_cost ?? 0,
            extras_cost: payload.extras_cost ?? 0,
          },
        };
      }

      // Release resources
      sideEffects.push(
        tx.unit.update({
          where: { id: trip.unit_id },
          data: { status: UnitStatus.disponible },
        }),
        tx.operator.update({
          where: { id: trip.operator_id },
          data: { status: OperatorStatus.disponible },
        })
      );
    } else if (newStatus === TripStatus.cancelado) {
      // programado -> cancelado OR en_curso -> cancelado
      if (trip.status === TripStatus.en_curso) {
        if (!payload?.cancellation_reason) {
          throw new AppError(
            400,
            "Se requiere un motivo de cancelación para viajes en curso"
          );
        }
        
        // Release resources if they were in use
        sideEffects.push(
          tx.unit.update({
            where: { id: trip.unit_id },
            data: { status: UnitStatus.disponible },
          }),
          tx.operator.update({
            where: { id: trip.operator_id },
            data: { status: OperatorStatus.disponible },
          })
        );
      }
      
      updateData.cancellation_reason = payload?.cancellation_reason;
    }

    // 4. Create history record
    sideEffects.push(
      tx.tripStatusHistory.create({
        data: {
          trip_id: tripId,
          status: newStatus,
          actor_id: actorId,
          cancellation_reason: payload?.cancellation_reason,
        },
      })
    );

    // Execute side effects and update trip
    await Promise.all(sideEffects);

    return tx.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        cost_detail: true,
        route: true,
        unit: true,
        operator: true,
        history: {
          orderBy: { created_at: "desc" },
          take: 10,
        },
      },
    });
  });
}
