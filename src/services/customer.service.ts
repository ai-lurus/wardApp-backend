import { withTenant } from "../lib/prisma";
import { Prisma, PrismaClient, TripStatus } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export interface CustomerFilters {
  search?: string;
}

export interface CustomerReportFilters {
  from_date?: string;
  to_date?: string;
}

export interface CustomerDto {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

export interface CustomerTripStats {
  trip_count: number; // non-cancelled trips (frequency)
  completed_count: number;
  revenue: number; // what the customer paid us (sum of entry_cost on completed trips)
  cost: number; // sum of actual_cost on completed trips
  profit: number;
  margin: number; // % of revenue
  last_trip_date: Date | null;
}

const emptyStats = (): CustomerTripStats => ({
  trip_count: 0,
  completed_count: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  margin: 0,
  last_trip_date: null,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

const computeMargin = (revenue: number, profit: number) =>
  revenue > 0 ? round2((profit / revenue) * 100) : 0;

/**
 * Aggregates trip frequency and finances per customer.
 * Money only counts completed trips; frequency counts every non-cancelled trip.
 */
async function aggregateTripsByCustomer(
  tx: PrismaClient,
  companyId: string,
  extraWhere: Prisma.TripWhereInput = {}
): Promise<Map<string, CustomerTripStats>> {
  const baseWhere: Prisma.TripWhereInput = {
    company_id: companyId,
    customer_id: { not: null },
    ...extraWhere,
  };

  const [frequency, finances] = await Promise.all([
    tx.trip.groupBy({
      by: ["customer_id"],
      where: { ...baseWhere, status: { not: TripStatus.cancelado } },
      _count: { _all: true },
      _max: { scheduled_date: true },
    }),
    tx.trip.groupBy({
      by: ["customer_id"],
      where: { ...baseWhere, status: TripStatus.completado },
      _count: { _all: true },
      _sum: { entry_cost: true, actual_cost: true },
    }),
  ]);

  const stats = new Map<string, CustomerTripStats>();

  for (const row of frequency) {
    if (!row.customer_id) continue;
    const s = emptyStats();
    s.trip_count = row._count._all;
    s.last_trip_date = row._max.scheduled_date;
    stats.set(row.customer_id, s);
  }

  for (const row of finances) {
    if (!row.customer_id) continue;
    const s = stats.get(row.customer_id) ?? emptyStats();
    s.completed_count = row._count._all;
    s.revenue = round2(row._sum.entry_cost ?? 0);
    s.cost = round2(row._sum.actual_cost ?? 0);
    s.profit = round2(s.revenue - s.cost);
    s.margin = computeMargin(s.revenue, s.profit);
    stats.set(row.customer_id, s);
  }

  return stats;
}

function buildDateFilter(filters: CustomerReportFilters): Prisma.TripWhereInput {
  if (!filters.from_date && !filters.to_date) return {};
  const scheduled_date: Prisma.DateTimeFilter = {};
  if (filters.from_date) scheduled_date.gte = new Date(filters.from_date);
  if (filters.to_date) scheduled_date.lte = new Date(filters.to_date);
  return { scheduled_date };
}

function normalizeEmail(email?: string | null) {
  if (email === undefined) return undefined;
  return email ? email : null;
}

export async function getCustomers(companyId: string, filters: CustomerFilters) {
  return withTenant(companyId, async (tx) => {
    const where: Prisma.CustomerWhereInput = {
      company_id: companyId,
      deleted_at: null,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [customers, stats] = await Promise.all([
      tx.customer.findMany({ where, orderBy: { name: "asc" } }),
      aggregateTripsByCustomer(tx, companyId),
    ]);

    return customers.map((c) => ({ ...c, stats: stats.get(c.id) ?? emptyStats() }));
  });
}

export async function getCustomerById(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });
    if (!customer) throw new AppError(404, "Cliente no encontrado");

    const [stats, trips] = await Promise.all([
      aggregateTripsByCustomer(tx, companyId, { customer_id: id }),
      tx.trip.findMany({
        where: { company_id: companyId, customer_id: id },
        include: { route: true, unit: true, operator: true },
        orderBy: { scheduled_date: "desc" },
        take: 100,
      }),
    ]);

    return { ...customer, stats: stats.get(id) ?? emptyStats(), trips };
  });
}

export async function createCustomer(companyId: string, data: CustomerDto) {
  return withTenant(companyId, async (tx) => {
    return tx.customer.create({
      data: {
        company_id: companyId,
        name: data.name,
        phone: data.phone,
        email: normalizeEmail(data.email) ?? null,
        notes: data.notes || null,
      },
    });
  });
}

export async function updateCustomer(companyId: string, id: string, data: Partial<CustomerDto>) {
  return withTenant(companyId, async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });
    if (!existing) throw new AppError(404, "Cliente no encontrado");

    return tx.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        email: normalizeEmail(data.email),
        notes: data.notes === undefined ? undefined : data.notes || null,
      },
    });
  });
}

export async function deleteCustomer(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });
    if (!existing) throw new AppError(404, "Cliente no encontrado");

    // Soft delete: trips keep their customer_id so historical reports stay intact
    return tx.customer.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  });
}

export async function getCustomerReport(companyId: string, filters: CustomerReportFilters) {
  return withTenant(companyId, async (tx) => {
    const stats = await aggregateTripsByCustomer(tx, companyId, buildDateFilter(filters));

    // Includes soft-deleted customers so totals match the trips in the period
    const customers = await tx.customer.findMany({
      where: { company_id: companyId, id: { in: [...stats.keys()] } },
      select: { id: true, name: true, phone: true, email: true, deleted_at: true },
    });

    const items = customers
      .map((c) => ({
        customer_id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        active: c.deleted_at === null,
        ...(stats.get(c.id) ?? emptyStats()),
      }))
      .sort((a, b) => b.trip_count - a.trip_count || b.revenue - a.revenue);

    const totals = items.reduce(
      (acc, i) => {
        acc.trip_count += i.trip_count;
        acc.completed_count += i.completed_count;
        acc.revenue += i.revenue;
        acc.cost += i.cost;
        return acc;
      },
      { customers_with_trips: items.length, trip_count: 0, completed_count: 0, revenue: 0, cost: 0 }
    );
    const profit = round2(totals.revenue - totals.cost);

    return {
      items,
      totals: {
        ...totals,
        revenue: round2(totals.revenue),
        cost: round2(totals.cost),
        profit,
        margin: computeMargin(totals.revenue, profit),
      },
    };
  });
}

/** Throws 404 unless the customer exists, belongs to the tenant and is not deleted. */
export async function assertCustomerAvailable(tx: PrismaClient, companyId: string, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, company_id: companyId, deleted_at: null },
    select: { id: true },
  });
  if (!customer) throw new AppError(404, "Cliente no encontrado");
}
