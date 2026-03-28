import { prisma, withTenant } from "../lib/prisma";

export async function getDashboardStats(companyId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return withTenant(companyId, async (tx) => {

    const [totalMaterials, materials, recentMovementsCount] = await Promise.all([
      tx.material.count({ where: { company_id: companyId, active: true } }),
      tx.material.findMany({
        where: { company_id: companyId, active: true },
        select: { current_stock: true, reference_price: true, min_stock: true },
      }),
      tx.inventoryMovement.count({
        where: {
          company_id: companyId,
          movement_date: { gte: thirtyDaysAgo },
        },
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
  });
}
