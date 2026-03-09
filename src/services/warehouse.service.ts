import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

// ─── Config ─────────────────────────────────────────────

export async function getOrCreateConfig(companyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    let config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    if (!config) {
      config = await tx.warehouseConfig.create({
        data: { company_id: companyId, width_m: 50, height_m: 30 },
      });
    }
    return config;
  });
}

export async function updateConfig(companyId: string, data: { width_m?: number; height_m?: number }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    let config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    if (!config) {
      config = await tx.warehouseConfig.create({
        data: { company_id: companyId, width_m: 50, height_m: 30 },
      });
    }
    return tx.warehouseConfig.update({ where: { id: config.id }, data });
  });
}

// ─── Zones ──────────────────────────────────────────────

export async function listZones(companyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    if (!config) return [];
    return tx.warehouseZone.findMany({
      where: { config_id: config.id },
      include: { _count: { select: { materials: true } } },
      orderBy: { created_at: "asc" },
    });
  });
}

interface CreateZoneData {
  name: string;
  description?: string;
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
  color?: string;
}

export async function createZone(companyId: string, data: CreateZoneData) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    let config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    if (!config) {
      config = await tx.warehouseConfig.create({
        data: { company_id: companyId, width_m: 50, height_m: 30 },
      });
    }
    return tx.warehouseZone.create({
      data: { ...data, config_id: config.id },
      include: { _count: { select: { materials: true } } },
    });
  });
}

interface UpdateZoneData {
  name?: string;
  description?: string;
  x_pct?: number;
  y_pct?: number;
  w_pct?: number;
  h_pct?: number;
  color?: string;
}

export async function updateZone(id: string, companyId: string, data: UpdateZoneData) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    const existing = await tx.warehouseZone.findFirst({
      where: { id, config_id: config?.id },
    });
    if (!existing) throw new AppError(404, "Zone not found");
    return tx.warehouseZone.update({
      where: { id },
      data,
      include: { _count: { select: { materials: true } } },
    });
  });
}

export async function deleteZone(id: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    const existing = await tx.warehouseZone.findFirst({
      where: { id, config_id: config?.id },
    });
    if (!existing) throw new AppError(404, "Zone not found");
    return tx.warehouseZone.delete({ where: { id } });
  });
}

// ─── Map (config + zones with materials) ────────────────

export async function getMap(companyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const config = await tx.warehouseConfig.findFirst({ where: { company_id: companyId } });
    if (!config) return { config: null, zones: [] };

    const zones = await tx.warehouseZone.findMany({
      where: { config_id: config.id },
      include: {
        materials: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            sku: true,
            current_stock: true,
            min_stock: true,
            unit: true,
          },
        },
        _count: { select: { materials: true } },
      },
      orderBy: { created_at: "asc" },
    });

    return { config, zones };
  });
}
