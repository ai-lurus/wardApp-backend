import jwt from "jsonwebtoken";
import { prisma } from "../../../src/lib/prisma";
import bcrypt from "bcrypt";
import { env } from "./setupEnv";
import { Company, User } from "@prisma/client";

interface TestTenant {
  company: Company;
  user: User;
  token: string;
}

export async function createTestTenant(name: string): Promise<TestTenant> {
  const uniqueId = Math.random().toString(36).substring(7);
  const companyPrefix = "TEST_TENANT_";

  const company = await prisma.company.create({
    data: {
      name: `${companyPrefix}${name}_${uniqueId}`,
      slug: `${name.toLowerCase()}-${uniqueId}`,
      subscription_status: "active",
      active_modules: ["inventario", "operaciones", "flotas", "clientes", "finanzas", "admin"],
      active: true,
    },
  });

  const password_hash = await bcrypt.hash("TestPass123!", 10);

  const user = await prisma.user.create({
    data: {
      company_id: company.id,
      email: `admin_${uniqueId}@${name.toLowerCase()}.com`,
      password_hash,
      name: `Admin ${name}`,
      role: "admin",
      active: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, role: user.role, companyId: user.company_id },
    env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return { company, user, token };
}

export async function cleanupTestData() {
  const testCompanies = await prisma.company.findMany({
    where: {
      name: {
        startsWith: "TEST_TENANT_",
      },
    },
    select: { id: true },
  });

  const companyIds = testCompanies.map(c => c.id);

  if (companyIds.length === 0) return;

  // Since prisma cascade deletes or some tables might not cascade, we might need to delete in order:
  // InventoryMovements, Materials, MaterialCategories, Units, RouteTollbooths, Routes, Tollbooths, Users, Companies
  await prisma.inventoryMovement.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.material.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.materialCategory.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.unit.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.routeTollbooth.deleteMany({
    where: {
      route: {
        company_id: { in: companyIds }
      }
    }
  });

  await prisma.route.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.tollbooth.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.user.deleteMany({
    where: { company_id: { in: companyIds } }
  });

  await prisma.company.deleteMany({
    where: { id: { in: companyIds } }
  });
}
