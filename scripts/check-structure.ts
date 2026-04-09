import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- CHECKING STRUCTURE ---');
  try {
    const res: any = await prisma.$queryRaw`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' 
      AND column_name = 'active_modules'
    `;
    console.log('Column info:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error checking columns:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
