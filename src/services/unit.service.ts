import { withTenant } from "../lib/prisma";
import { UnitStatus, UnitType, Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export interface UnitFilters {
  status?: UnitStatus;
  type?: UnitType;
  // available_only?: boolean;
}

export async function getUnits(companyId: string, filters: UnitFilters) {
  return withTenant(companyId, async (tx) => {
    const where: Prisma.UnitWhereInput = {
      company_id: companyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    // TODO: Implementar filtro de unidades disponibles en un futuro
    // if (filters.available_only) {
    //   where.status = UnitStatus.disponible;
    // }

    return tx.unit.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  });
}

export async function getUnitById(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    return tx.unit.findFirst({
      where: { id, company_id: companyId },
    });
  });
}

export async function createUnit(companyId: string, data: any) {
  return withTenant(companyId, async (tx) => {
    // Si el VIN viene en los datos, verificar duplicados
    if (data.vin) {
      const existingVin = await tx.unit.findFirst({
        where: {
          company_id: companyId,
          vin: data.vin,
        },
      });
      if (existingVin) {
        throw new AppError(
          400,
          `Ya existe una unidad registrada con el VIN: ${data.vin} en la empresa`,
        );
      }
    }
    // Verificar placa (plate)
    const existingPlate = await tx.unit.findFirst({
      where: {
        company_id: companyId,
        plate: data.plate,
      },
    });
    if (existingPlate) {
      throw new AppError(
        400,
        `La matrícula ${data.plate} ya está registrada en la empresa`,
      );
    }

    return tx.unit.create({
      data: {
        ...data,
        company_id: companyId,
      },
    });
  });
}

export async function updateUnit(companyId: string, id: string, data: any) {
  return withTenant(companyId, async (tx) => {
    // Verificar que la unidad pertenezca a la empresa
    const unit = await tx.unit.findFirst({
      where: { id, company_id: companyId },
    });

    if (!unit) {
      throw new AppError(404, "Unidad no encontrada o no pertenece a la empresa");
    }

    return tx.unit.update({
      where: { id },
      data,
    });
  });
}

export async function updateUnitStatus(
  companyId: string,
  id: string,
  newStatus: UnitStatus,
) {
  return withTenant(companyId, async (tx) => {
    const unit = await tx.unit.findFirst({
      where: { id, company_id: companyId },
    });

    if (!unit) {
      throw new AppError(404, "Unit not found");
    }

    // Business rule: Bloquear si en_viaje intenta pasar a inactivo
    if (
      unit.status === UnitStatus.en_viaje &&
      newStatus === UnitStatus.inactivo
    ) {
      throw new AppError(
        400,
        "No se puede desactivar una unidad que se encuentra en viaje",
      );
    }

    return tx.unit.update({
      where: { id },
      data: { status: newStatus },
    });
  });
}

export async function getInsuranceAlerts(companyId: string) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return withTenant(companyId, async (tx) => {
    return tx.unit.findMany({
      where: {
        company_id: companyId,
        insurance_expiry: {
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: { insurance_expiry: "asc" },
    });
  });
}
