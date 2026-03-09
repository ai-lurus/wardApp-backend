import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLATFORM_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "chlau@ai-lurus.com";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "password";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  // Ensure platform company exists
  await prisma.company.upsert({
    where: { id: PLATFORM_COMPANY_ID },
    create: { id: PLATFORM_COMPANY_ID, name: "Ward Platform", slug: "ward-platform" },
    update: {},
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists — skipping.`);
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      company_id: PLATFORM_COMPANY_ID,
      email,
      name,
      password_hash,
      role: "super_admin",
    },
  });

  console.log(`Super admin created: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
