import bcrypt from "bcrypt";
import { AppError } from "../middleware/errorHandler";
import { prisma, withTenant } from "../lib/prisma";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  created_at: true,
} as const;

export async function listUsers(companyId: string) {
  return withTenant(companyId, async (tx) => {
    return tx.user.findMany({
      where: { company_id: companyId },
      select: USER_SELECT,
      orderBy: { created_at: "asc" },
    });
  });
}

export async function createUser(data: {
  companyId: string;
  email: string;
  name: string;
  password: string;
  role: string;
}) {
  return withTenant(data.companyId, async (tx) => {

    const existing = await tx.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, "Email already in use");

    const password_hash = await bcrypt.hash(data.password, 10);
    return tx.user.create({
      data: {
        company_id: data.companyId,
        email: data.email,
        name: data.name,
        password_hash,
        role: data.role,
      },
      select: USER_SELECT,
    });
  });
}

export async function updateUser(
  id: string,
  companyId: string,
  data: { name?: string; email?: string; role?: string; password?: string }
) {
  return withTenant(companyId, async (tx) => {

    const user = await tx.user.findFirst({ where: { id, company_id: companyId } });
    if (!user) throw new AppError(404, "User not found");

    if (data.email && data.email !== user.email) {
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError(409, "Email already in use");
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.password_hash = await bcrypt.hash(data.password, 10);

    return tx.user.update({ where: { id }, data: updateData, select: USER_SELECT });
  });
}

export async function setUserStatus(id: string, companyId: string, active: boolean) {
  return withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({ where: { id, company_id: companyId } });
    if (!user) throw new AppError(404, "User not found");
    return tx.user.update({ where: { id }, data: { active }, select: USER_SELECT });
  });
}
