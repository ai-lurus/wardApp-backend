import bcrypt from "bcrypt";
import { AppModule } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { sendWelcomeEmail } from "./email.service";

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  active: true,
  active_modules: true,
  created_at: true,
} as const;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  created_at: true,
} as const;

// ─── Companies ───────────────────────────────────────────

export async function listCompanies() {
  return prisma.company.findMany({
    select: {
      ...COMPANY_SELECT,
      _count: { select: { users: true } },
    },
    orderBy: { created_at: "asc" },
  });
}

export async function getCompany(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      ...COMPANY_SELECT,
      users: { select: USER_SELECT, orderBy: { created_at: "asc" } },
    },
  });
  if (!company) throw new AppError(404, "Company not found");
  return company;
}

export async function createCompany(data: {
  name: string;
  slug: string;
  active_modules: AppModule[];
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}) {
  const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError(409, "Slug already in use");

  const existingUser = await prisma.user.findUnique({ where: { email: data.adminEmail } });
  if (existingUser) throw new AppError(409, "Email already in use");

  const password_hash = await bcrypt.hash(data.adminPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { 
        name: data.name, 
        slug: data.slug,
        active_modules: data.active_modules as import("@prisma/client").AppModule[] 
      },
      select: COMPANY_SELECT,
    });

    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${company.id}, true)`;

    const user = await tx.user.create({
      data: {
        company_id: company.id,
        email: data.adminEmail,
        name: data.adminName,
        password_hash,
        role: "admin",
      },
      select: USER_SELECT,
    });

    return { company, adminUser: user };
  });

  // Send welcome email (non-blocking — don't fail the request if email errors)
  sendWelcomeEmail({
    to: result.adminUser.email,
    name: result.adminUser.name,
    companyName: result.company.name,
    password: data.adminPassword,
  }).catch((err) => console.error("[email] Welcome email failed:", err));

  return result;
}

export async function updateCompany(
  id: string,
  data: { name?: string; slug?: string; active?: boolean; active_modules?: AppModule[] }
) {
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new AppError(404, "Company not found");

  if (data.slug && data.slug !== company.slug) {
    const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError(409, "Slug already in use");
  }

  return prisma.company.update({ where: { id }, data: { ...data, active_modules: data.active_modules as import("@prisma/client").AppModule[] | undefined }, select: COMPANY_SELECT });
}

// ─── Users within a company ──────────────────────────────

export async function listCompanyUsers(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "Company not found");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return tx.user.findMany({
      where: { company_id: companyId },
      select: USER_SELECT,
      orderBy: { created_at: "asc" },
    });
  });
}

export async function createCompanyUser(
  companyId: string,
  data: { email: string; name: string; password: string; role: string }
) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "Company not found");

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, "Email already in use");

  const password_hash = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    return tx.user.create({
      data: {
        company_id: companyId,
        email: data.email,
        name: data.name,
        password_hash,
        role: data.role,
      },
      select: USER_SELECT,
    });
  });

  sendWelcomeEmail({
    to: user.email,
    name: user.name,
    companyName: company.name,
    password: data.password,
  }).catch((err) => console.error("[email] Welcome email failed:", err));

  return user;
}
