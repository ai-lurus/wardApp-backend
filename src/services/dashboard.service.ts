import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getDashboardStats() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalMaterials, materials, recentMovementsCount] = await Promise.all([
    prisma.material.count({ where: { active: true } }),
    prisma.material.findMany({
      where: { active: true },
      select: { current_stock: true, reference_price: true, min_stock: true },
    }),
    prisma.inventoryMovement.count({
      where: { movement_date: { gte: thirtyDaysAgo } },
    }),
  ]);

  const lowStockCount = materials.filter(
    (m) => m.current_stock <= m.min_stock
  ).length;

  const totalInventoryValue = materials.reduce(
    (sum, m) => sum + m.current_stock * (m.reference_price ?? 0),
    0
  );

  return {
    totalMaterials,
    lowStockCount,
    totalInventoryValue,
    recentMovementsCount,
  };
}
