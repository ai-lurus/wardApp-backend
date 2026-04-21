import { Prisma } from "@prisma/client";
import { withTenant } from "../lib/prisma";

export type CreateTollboothInput = Omit<
  Prisma.TollboothUncheckedCreateInput,
  "id" | "company_id" | "created_at" | "updated_at"
>;

export type UpdateTollboothInput = Partial<CreateTollboothInput>;

export async function getTollbooths(companyId: string, options: { active?: boolean; search?: string } = {}) {
  return await withTenant(companyId, async (tx) => {
    const where: Prisma.TollboothWhereInput = { company_id: companyId };
    
    if (options.search) {
      where.name = { contains: options.search, mode: "insensitive" };
    }
    if (options.active !== undefined) {
      where.active = options.active;
    }
    return tx.tollbooth.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  });
}

export async function getTollboothById(companyId: string, id: string) {
  return await withTenant(companyId, async (tx) => {
    return tx.tollbooth.findFirst({
      where: { id, company_id: companyId },
    });
  });
}

export async function createTollbooth(companyId: string, data: CreateTollboothInput) {
  return await withTenant(companyId, async (tx) => {
    return tx.tollbooth.create({
      data: {
        ...data,
        company_id: companyId,
      },
    });
  });
}

export async function updateTollbooth(companyId: string, id: string, data: UpdateTollboothInput) {
  return await withTenant(companyId, async (tx) => {
    const tollbooth = await tx.tollbooth.findFirst({
      where: { id, company_id: companyId },
    });

    if (!tollbooth) return null;

    return tx.tollbooth.update({
      where: { id },
      data,
    });
  });
}

export async function deleteTollbooth(companyId: string, id: string) {
  return await withTenant(companyId, async (tx) => {
    const tollbooth = await tx.tollbooth.findFirst({
      where: { id, company_id: companyId },
    });

    if (!tollbooth) return null;

    return tx.tollbooth.update({
      where: { id },
      data: { active: false },
    });
  });
}
