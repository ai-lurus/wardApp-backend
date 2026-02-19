import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

// ─── Config ─────────────────────────────────────────────

export async function getOrCreateConfig() {
  let config = await prisma.warehouseConfig.findFirst();
  if (!config) {
    config = await prisma.warehouseConfig.create({
      data: { width_m: 50, height_m: 30 },
    });
  }
  return config;
}

export async function updateConfig(data: { width_m?: number; height_m?: number }) {
  const config = await getOrCreateConfig();
  return prisma.warehouseConfig.update({
    where: { id: config.id },
    data,
  });
}

// ─── Zones ──────────────────────────────────────────────

export async function listZones() {
  const config = await getOrCreateConfig();
  return prisma.warehouseZone.findMany({
    where: { config_id: config.id },
    include: { _count: { select: { materials: true } } },
    orderBy: { created_at: "asc" },
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

export async function createZone(data: CreateZoneData) {
  const config = await getOrCreateConfig();
  return prisma.warehouseZone.create({
    data: { ...data, config_id: config.id },
    include: { _count: { select: { materials: true } } },
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

export async function updateZone(id: string, data: UpdateZoneData) {
  const existing = await prisma.warehouseZone.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Zone not found");
  }
  return prisma.warehouseZone.update({
    where: { id },
    data,
    include: { _count: { select: { materials: true } } },
  });
}

export async function deleteZone(id: string) {
  const existing = await prisma.warehouseZone.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Zone not found");
  }
  // Materials.zone_id is set to NULL via onDelete: SetNull in schema
  return prisma.warehouseZone.delete({ where: { id } });
}

// ─── Map (config + zones with materials) ────────────────

export async function getMap() {
  const config = await getOrCreateConfig();
  const zones = await prisma.warehouseZone.findMany({
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
}
