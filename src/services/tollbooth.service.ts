import { Prisma } from "@prisma/client";
import { withTenant } from "../lib/prisma";

export type CreateTollboothInput = Omit<
  Prisma.TollboothUncheckedCreateInput,
  "id" | "company_id" | "created_at" | "updated_at"
>;

export type UpdateTollboothInput = Partial<CreateTollboothInput>;

export async function getTollbooths(companyId: string, options: { active?: boolean } = {}) {
  return await withTenant(companyId, async (tx) => {
    const where: Prisma.TollboothWhereInput = { company_id: companyId };
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
    // Check if exists first to avoid cross-tenant updates 
    // Prisma does not support where with composite explicitly without providing both parts if they are not unique together
    // wait, I need to check schema if id + company_id is unique. It's not. 
    // I should just use `id` and check if `company_id` matches, or use findFirst + update
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
