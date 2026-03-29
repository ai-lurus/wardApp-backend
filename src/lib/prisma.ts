import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Run a block of Prisma queries with the tenant RLS context set.
 * All queries inside the callback execute within a transaction that
 * sets `app.current_company_id` so Postgres RLS policies are satisfied.
 *
 * Usage:
 *   const result = await withTenant(companyId, (tx) =>
 *     tx.material.findMany({ where: { company_id: companyId } })
 *   );
 */
export async function withTenant<T>(
  companyId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Explicitly cast to text/uuid to avoid operator mismatch in Postgres
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}::text, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}
