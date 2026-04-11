import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- CHECKING ENUM NAMESPACE ---');
  try {
    const res: any = await prisma.$queryRaw`
      SELECT n.nspname as schema_name, t.typname as type_name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'AppModule'
    `;
    console.log('Enum info:', JSON.stringify(res, null, 2));
    
    const user: any = await prisma.$queryRaw`
      SELECT id, email, company_id FROM users WHERE email = 'cesrvarg8@gmail.com'
    `;
    console.log('User found:', JSON.stringify(user, null, 2));
    
  } catch (err) {
    console.error('Error checking enum:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
