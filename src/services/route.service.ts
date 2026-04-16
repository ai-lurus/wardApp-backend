import { Prisma } from "@prisma/client";
import { withTenant } from "../lib/prisma";

export type RouteTollboothInput = {
  tollbooth_id: string;
  order: number;
};

export type CreateRouteInput = Omit<
  Prisma.RouteUncheckedCreateInput,
  "id" | "company_id" | "created_at" | "updated_at"
> & {
  tollbooths: RouteTollboothInput[];
};

export type UpdateRouteInput = Partial<
  Omit<Prisma.RouteUncheckedCreateInput, "id" | "company_id" | "created_at" | "updated_at">
> & {
  tollbooths?: RouteTollboothInput[];
};

export async function getRoutes(companyId: string, options: { origin?: string; destination?: string; active?: boolean } = {}) {
  return await withTenant(companyId, async (tx) => {
    const where: Prisma.RouteWhereInput = { company_id: companyId };
    
    if (options.origin) {
      where.origin = { contains: options.origin, mode: "insensitive" };
    }
    if (options.destination) {
      where.destination = { contains: options.destination, mode: "insensitive" };
    }
    if (options.active !== undefined) {
      where.active = options.active;
    }

    return tx.route.findMany({
      where,
      include: {
        route_tollbooths: {
          orderBy: { order: "asc" },
          include: { tollbooth: true },
        },
      },
      orderBy: { created_at: "desc" },
    });
  });
}

export async function getRouteById(companyId: string, id: string) {
  return await withTenant(companyId, async (tx) => {
    return tx.route.findFirst({
      where: { id, company_id: companyId },
      include: {
        route_tollbooths: {
          orderBy: { order: "asc" },
          include: { tollbooth: true },
        },
      },
    });
  });
}

export async function createRoute(companyId: string, input: CreateRouteInput) {
  return await withTenant(companyId, async (tx) => {
    const { tollbooths, ...routeData } = input;

    // Check if tollbooths exist and belong to the company
    if (tollbooths.length > 0) {
      const tollboothIds = tollbooths.map(t => t.tollbooth_id);
      const existingTollbooths = await tx.tollbooth.findMany({
        where: { id: { in: tollboothIds }, company_id: companyId, active: true },
      });
      if (existingTollbooths.length !== tollboothIds.length) {
        throw new Error("Una o más casetas no existen o no están activas.");
      }
    }

    return tx.route.create({
      data: {
        ...routeData,
        company_id: companyId,
        route_tollbooths: {
          create: tollbooths.map((tb) => ({
            tollbooth_id: tb.tollbooth_id,
            order: tb.order,
          })),
        },
      },
      include: {
        route_tollbooths: {
          include: { tollbooth: true },
        },
      },
    });
  });
}

export async function updateRoute(companyId: string, id: string, input: UpdateRouteInput) {
  return await withTenant(companyId, async (tx) => {
    const route = await tx.route.findFirst({
      where: { id, company_id: companyId },
    });

    if (!route) return null;

    const { tollbooths, ...routeData } = input;

    if (tollbooths) {
      const tollboothIds = tollbooths.map(t => t.tollbooth_id);
      const existingTollbooths = await tx.tollbooth.findMany({
        where: { id: { in: tollboothIds }, company_id: companyId, active: true },
      });
      if (existingTollbooths.length !== tollboothIds.length) {
        throw new Error("Una o más casetas no existen o no están activas.");
      }
      
      // Update by deleting old associations and creating new ones
      await tx.routeTollbooth.deleteMany({
        where: { route_id: id },
      });
    }

    return tx.route.update({
      where: { id },
      data: {
        ...routeData,
        ...(tollbooths && {
          route_tollbooths: {
            create: tollbooths.map((tb) => ({
              tollbooth_id: tb.tollbooth_id,
              order: tb.order,
            })),
          },
        }),
      },
      include: {
        route_tollbooths: {
          orderBy: { order: "asc" },
          include: { tollbooth: true },
        },
      },
    });
  });
}

export async function deleteRoute(companyId: string, id: string) {
  return await withTenant(companyId, async (tx) => {
    const route = await tx.route.findFirst({
      where: { id, company_id: companyId },
    });

    if (!route) return null;

    return tx.route.update({
      where: { id },
      data: { active: false },
    });
  });
}

export async function getRouteCostPreview(companyId: string, id: string, axles: number) {
  return await withTenant(companyId, async (tx) => {
    const route = await tx.route.findFirst({
      where: { id, company_id: companyId },
      include: {
        route_tollbooths: {
          include: { tollbooth: true },
        },
      },
    });

    if (!route) {
      throw new Error("Ruta no encontrada");
    }

    let totalCost = 0;
    for (const rt of route.route_tollbooths) {
      if (!rt.tollbooth.active) continue; // Optional: skip inactive tollbooths
      
      switch (axles) {
        case 2:
          totalCost += rt.tollbooth.cost_2_axles;
          break;
        case 3:
          totalCost += rt.tollbooth.cost_3_axles;
          break;
        case 4:
          totalCost += rt.tollbooth.cost_4_axles;
          break;
        case 5:
          totalCost += rt.tollbooth.cost_5_axles;
          break;
        case 6:
          totalCost += rt.tollbooth.cost_6_axles;
          break;
        default:
          if (axles >= 7) {
            totalCost += rt.tollbooth.cost_7_plus_axles;
          }
          break;
      }
    }

    return {
      route_id: id,
      axles,
      total_cost: totalCost,
      currency: "MXN",
    };
  });
}
