import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tables = [
    'users',
    'material_categories',
    'materials',
    'warehouse_config',
    'inventory_movements'
  ];

  for (const table of tables) {
    console.log(`Fixing RLS policy for ${table}...`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "tenant_isolation" ON "${table}"
      USING (company_id::text = current_setting('app.current_company_id', true))
      WITH CHECK (company_id::text = current_setting('app.current_company_id', true))
    `);
  }

  console.log('All RLS policies fixed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
