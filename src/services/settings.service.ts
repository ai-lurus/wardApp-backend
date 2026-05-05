import { withTenant } from "../lib/prisma";

export interface UpdateSettingsDto {
  fuel_price_per_liter?: number;
  fuel_efficiency_km_l?: number;
  estimated_trips_per_month?: number;
  monthly_insurance_cost?: number;
}

export async function getSettings(companyId: string) {
  return withTenant(companyId, async (tx) => {
    // Usamos upsert para asegurar que siempre haya un registro de configuración por tenant.
    // Si no existe, se crearán los valores por default definidos en el schema.prisma
    return tx.tenantSettings.upsert({
      where: { company_id: companyId },
      update: {},
      create: {
        company_id: companyId,
      },
    });
  });
}

export async function updateSettings(companyId: string, data: UpdateSettingsDto) {
  return withTenant(companyId, async (tx) => {
    return tx.tenantSettings.upsert({
      where: { company_id: companyId },
      update: {
        ...data
      },
      create: {
        company_id: companyId,
        ...data
      },
    });
  });
}
