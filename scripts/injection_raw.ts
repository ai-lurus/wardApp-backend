
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING RAW DB INJECTION ---');
  
  // 1. Ensure cesrvarg8@gmail.com's company has fleet access
  // Actually, I saw it already has. But just in case, I'll run a check/update.
  const user1Email = 'cesrvarg8@gmail.com';
  console.log(`Checking fleet access for ${user1Email}...`);
  
  // Use raw SQL to avoid type mismatch issues with Prisma generated client for enums
  await prisma.$executeRaw`
    UPDATE companies 
    SET active_modules = array_append(active_modules, 'flotas'::"AppModule")
    WHERE id = (SELECT company_id FROM users WHERE email = ${user1Email})
    AND NOT ('flotas'::"AppModule" = ANY(active_modules));
  `;
  console.log(`Ensured ${user1Email} has fleet access in their company.`);

  // 2. Create another company for a different user
  const otherCompanySlug = 'trans-logistica';
  const otherCompanyName = 'Transportes y Logística de México';
  
  // Create company if not exists
  const existingCompany = await prisma.company.findUnique({ where: { slug: otherCompanySlug } });
  let companyId: string;
  
  if (!existingCompany) {
    console.log(`Creating company ${otherCompanyName}...`);
    // Create using raw SQL to be safe with the enum array
    const newCompanyId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO companies (id, name, slug, active, subscription_status, active_modules, updated_at)
      VALUES (
        ${newCompanyId}::uuid, 
        ${otherCompanyName}, 
        ${otherCompanySlug}, 
        true, 
        'active', 
        ARRAY['inventario', 'flotas']::"AppModule"[],
        NOW()
      );
    `;
    companyId = newCompanyId;
    console.log(`Created new company: ${otherCompanyName}`);
  } else {
    companyId = existingCompany.id;
    console.log(`Found existing other company: ${otherCompanyName}`);
    // Ensure 'flotas' is active
    await prisma.$executeRaw`
      UPDATE companies 
      SET active_modules = array_append(active_modules, 'flotas'::"AppModule")
      WHERE id = ${companyId}::uuid
      AND NOT ('flotas'::"AppModule" = ANY(active_modules));
    `;
    console.log(`Ensured 'flotas' module active for ${otherCompanyName}`);
  }

  // 3. Create a new user for the other company
  const newUserEmail = 'admin@translogistica.com.mx';
  const existingNewUser = await prisma.user.findUnique({ where: { email: newUserEmail } });

  if (!existingNewUser) {
    const hash = await bcrypt.hash('demo123', 10);
    // Use raw SQL to avoid any id/foreign key issues if their types are also customized
    await prisma.$executeRaw`
      INSERT INTO users (id, company_id, email, password_hash, name, role, active, updated_at)
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${companyId}::uuid,
        ${newUserEmail},
        ${hash},
        'Gerente Logística',
        'admin',
        true,
        NOW()
      );
    `;
    console.log(`Created new user: ${newUserEmail} for company ${otherCompanyName}`);
  } else {
    console.log(`User ${newUserEmail} already exists.`);
  }

  console.log('--- RAW DB INJECTION COMPLETED ---');
}

main()
  .catch((e) => {
    console.error('Injection failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
