import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

interface ListMaterialsParams {
  category_id?: string;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listMaterials(params: ListMaterialsParams) {
  const { category_id, active, search, page = 0, limit = 25 } = params;

  const where: any = {};
  if (category_id) where.category_id = category_id;
  if (active !== undefined) where.active = active;
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const [items, count] = await Promise.all([
    prisma.material.findMany({
      where,
      include: { category: true, zone: true },
      skip: page * limit,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.material.count({ where }),
  ]);

  return { items, count, page, limit };
}

export async function getMaterial(id: string) {
  const material = await prisma.material.findUnique({
    where: { id },
    include: { category: true, zone: true },
  });

  if (!material) {
    throw new AppError(404, "Material not found");
  }

  return material;
}

interface CreateMaterialData {
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
  const category = await prisma.materialCategory.findUnique({
    where: { id: data.category_id },
  });
  if (!category) {
    throw new AppError(400, "Category not found");
  }

  return prisma.material.create({
    data,
    include: { category: true, zone: true },
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

export async function updateMaterial(id: string, data: UpdateMaterialData) {
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Material not found");
  }

  if (data.category_id) {
    const category = await prisma.materialCategory.findUnique({
      where: { id: data.category_id },
    });
    if (!category) {
      throw new AppError(400, "Category not found");
    }
  }

  return prisma.material.update({
    where: { id },
    data,
    include: { category: true, zone: true },
  });
}

export async function deleteMaterial(id: string) {
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Material not found");
  }

  return prisma.material.update({
    where: { id },
    data: { active: false },
  });
}

export async function listCategories() {
  return prisma.materialCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { materials: true } } },
  });
}

export async function createCategory(name: string, description?: string) {
  const existing = await prisma.materialCategory.findUnique({
    where: { name },
  });
  if (existing) {
    throw new AppError(409, "Category already exists");
  }

  return prisma.materialCategory.create({
    data: { name, description },
  });
}

export async function updateCategory(
  id: string,
  name?: string,
  description?: string
) {
  const existing = await prisma.materialCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "Category not found");
  }

  if (name && name !== existing.name) {
    const nameConflict = await prisma.materialCategory.findUnique({
      where: { name },
    });
    if (nameConflict) {
      throw new AppError(409, "Category name already in use");
    }
  }

  return prisma.materialCategory.update({
    where: { id },
    data: { name, description },
  });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.materialCategory.findUnique({
    where: { id },
    include: { _count: { select: { materials: true } } },
  });
  if (!existing) {
    throw new AppError(404, "Category not found");
  }

  if (existing._count.materials > 0) {
    throw new AppError(
      409,
      `Cannot delete category with ${existing._count.materials} associated material(s)`
    );
  }

  return prisma.materialCategory.delete({ where: { id } });
}
