import { PrismaClient, AppModule } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "pdemo@ialurus.com";
  const password = "demo123";
  const name = "Premium Demo User";
  const companySlug = "premium-demo-corp";

  console.log(`Creating/Updating company ${companySlug}...`);
  
  // 1. Create or Update Company with ALL modules and active status
  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: {
      active: true,
      subscription_status: "active",
      active_modules: [
        AppModule.inventario,
        AppModule.operaciones,
        AppModule.flotas,
        AppModule.clientes,
        AppModule.finanzas,
        AppModule.admin,
        AppModule.warden
      ]
    },
    create: {
      name: "Premium Demo Corporation",
      slug: companySlug,
      active: true,
      subscription_status: "active",
      active_modules: [
        AppModule.inventario,
        AppModule.operaciones,
        AppModule.flotas,
        AppModule.clientes,
        AppModule.finanzas,
        AppModule.admin,
        AppModule.warden
      ]
    }
  });

  console.log(`Company ID: ${company.id}`);

  // 2. Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Create or Update User
  const user = await prisma.user.upsert({
    where: { email: email },
    update: {
      name: name,
      password_hash: passwordHash,
      role: "admin", // Standard admin for the company
      active: true,
      company_id: company.id
    },
    create: {
      email: email,
      name: name,
      password_hash: passwordHash,
      role: "admin",
      active: true,
      company_id: company.id
    }
  });

  console.log(`User created/updated: ${user.email} with role ${user.role}`);
  console.log(`Access to modules: ${company.active_modules.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
