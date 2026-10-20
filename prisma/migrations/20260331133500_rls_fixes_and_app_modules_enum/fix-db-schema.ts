import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Altering column type...");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "companies" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`);
    console.log("Success! companies.id is now UUID.");
  } catch (err) {
    console.log("Error:", String(err));
  }
}
main().catch(console.error).finally(()=>prisma.$disconnect());
