import { PrismaClient, MovementType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

interface EntryData {
  material_id: string;
  quantity: number;
  unit_cost?: number;
  supplier?: string;
  invoice_number?: string;
  notes?: string;
  created_by: string;
}

export async function registerEntry(data: EntryData) {
  const material = await prisma.material.findUnique({
    where: { id: data.material_id },
  });

  if (!material || !material.active) {
    throw new AppError(404, "Material not found");
  }

  const total_cost =
    data.unit_cost != null ? data.unit_cost * data.quantity : undefined;

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        material_id: data.material_id,
        type: MovementType.entry,
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        total_cost,
        supplier: data.supplier,
        invoice_number: data.invoice_number,
        notes: data.notes,
        created_by: data.created_by,
      },
      include: { material: true },
    }),
    prisma.material.update({
      where: { id: data.material_id },
      data: { current_stock: { increment: data.quantity } },
    }),
  ]);

  return movement;
}

interface ExitData {
  material_id: string;
  quantity: number;
  destination?: string;
  reason?: string;
  notes?: string;
  created_by: string;
}

export async function registerExit(data: ExitData) {
  const material = await prisma.material.findUnique({
    where: { id: data.material_id },
  });

  if (!material || !material.active) {
    throw new AppError(404, "Material not found");
  }

  if (material.current_stock < data.quantity) {
    throw new AppError(
      400,
      `Insufficient stock. Available: ${material.current_stock}, requested: ${data.quantity}`
    );
  }

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        material_id: data.material_id,
        type: MovementType.exit,
        quantity: data.quantity,
        destination: data.destination,
        reason: data.reason,
        notes: data.notes,
        created_by: data.created_by,
      },
      include: { material: true },
    }),
    prisma.material.update({
      where: { id: data.material_id },
      data: { current_stock: { decrement: data.quantity } },
    }),
  ]);

  return movement;
}

interface ListMovementsParams {
  type?: MovementType;
  material_id?: string;
  page?: number;
  limit?: number;
}

export async function listMovements(params: ListMovementsParams) {
  const { type, material_id, page = 0, limit = 25 } = params;

  const where: any = {};
  if (type) where.type = type;
  if (material_id) where.material_id = material_id;

  const [items, count] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      include: {
        material: { select: { name: true, unit: true } },
        user: { select: { name: true } },
      },
      skip: page * limit,
      take: limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return { items, count, page, limit };
}

export async function getStock(lowStockOnly?: boolean) {
  const where: any = { active: true };

  const materials = await prisma.material.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  if (lowStockOnly) {
    return materials.filter((m) => m.current_stock <= m.min_stock);
  }

  return materials;
}

export async function getAlerts() {
  return prisma.material.findMany({
    where: {
      active: true,
    },
    include: { category: { select: { name: true } } },
    orderBy: { name: "asc" },
  }).then((materials) =>
    materials
      .filter((m) => m.current_stock <= m.min_stock)
      .map((m) => ({
        ...m,
        deficit: m.min_stock - m.current_stock,
      }))
  );
}
