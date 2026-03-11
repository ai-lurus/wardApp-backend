import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

async function setTenant(tx: typeof prisma, companyId: string) {
  await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
}

interface ListMaterialsParams {
  companyId: string;
  category_id?: string;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listMaterials(params: ListMaterialsParams) {
  const { companyId, category_id, active, search, page = 0, limit = 25 } = params;

  const where: any = { company_id: companyId };
  if (category_id) where.category_id = category_id;
  if (active !== undefined) where.active = active;
  if (search) where.name = { contains: search, mode: "insensitive" };

  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const [items, count] = await Promise.all([
      tx.material.findMany({
        where,
        include: { category: true, zone: true },
        skip: page * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      tx.material.count({ where }),
    ]);
    return { items, count, page, limit };
  });
}

export async function getMaterial(id: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const material = await tx.material.findFirst({
      where: { id, company_id: companyId },
      include: { category: true, zone: true },
    });
    if (!material) throw new AppError(404, "Material not found");
    return material;
  });
}

interface CreateMaterialData {
  companyId: string;
  name: string;
  sku?: string;
  location?: string;
  zone_id?: string | null;
  category_id: string;
  unit?: string;
  reference_price?: number;
  min_stock?: number;
  current_stock?: number;
}

export async function createMaterial(data: CreateMaterialData) {
  const { companyId, ...rest } = data;

  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const category = await tx.materialCategory.findFirst({
      where: { id: rest.category_id, company_id: companyId },
    });
    if (!category) throw new AppError(400, "Category not found");

    return tx.material.create({
      data: { ...rest, company_id: companyId },
      include: { category: true, zone: true },
    });
  });
}

interface UpdateMaterialData {
  name?: string;
  sku?: string;
  location?: string;
  zone_id?: string | null;
  category_id?: string;
  unit?: string;
  reference_price?: number;
  min_stock?: number;
  active?: boolean;
}

export async function updateMaterial(id: string, companyId: string, data: UpdateMaterialData) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const existing = await tx.material.findFirst({ where: { id, company_id: companyId } });
    if (!existing) throw new AppError(404, "Material not found");

    if (data.category_id) {
      const category = await tx.materialCategory.findFirst({
        where: { id: data.category_id, company_id: companyId },
      });
      if (!category) throw new AppError(400, "Category not found");
    }

    return tx.material.update({
      where: { id },
      data,
      include: { category: true, zone: true },
    });
  });
}

export async function deleteMaterial(id: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const existing = await tx.material.findFirst({ where: { id, company_id: companyId } });
    if (!existing) throw new AppError(404, "Material not found");
    return tx.material.update({ where: { id }, data: { active: false } });
  });
}

export async function listCategories(companyId: string) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    return tx.materialCategory.findMany({
      where: { company_id: companyId },
      orderBy: { name: "asc" },
      include: { _count: { select: { materials: true } } },
    });
  });
}

export async function createCategory(companyId: string, name: string, description?: string) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const existing = await tx.materialCategory.findFirst({
      where: { company_id: companyId, name },
    });
    if (existing) throw new AppError(409, "Category already exists");
    return tx.materialCategory.create({
      data: { company_id: companyId, name, description },
    });
  });
}

export async function updateCategory(
  id: string,
  companyId: string,
  name?: string,
  description?: string
) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const existing = await tx.materialCategory.findFirst({ where: { id, company_id: companyId } });
    if (!existing) throw new AppError(404, "Category not found");

    if (name && name !== existing.name) {
      const conflict = await tx.materialCategory.findFirst({
        where: { company_id: companyId, name },
      });
      if (conflict) throw new AppError(409, "Category name already in use");
    }

    return tx.materialCategory.update({ where: { id }, data: { name, description } });
  });
}

export async function deleteCategory(id: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    await setTenant(tx as any, companyId);
    const existing = await tx.materialCategory.findFirst({
      where: { id, company_id: companyId },
      include: { _count: { select: { materials: true } } },
    });
    if (!existing) throw new AppError(404, "Category not found");
    if (existing._count.materials > 0) {
      throw new AppError(
        409,
        `No se puede eliminar la categoría porque está asociada a ${existing._count.materials} material(es)`
      );
    }
    return tx.materialCategory.delete({ where: { id } });
  });
}
