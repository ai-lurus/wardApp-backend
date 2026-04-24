import request from "supertest";
import app from "../../src/server";
import { prisma } from "../../src/lib/prisma";
import { createTestTenant, cleanupTestData } from "./helpers/setup";
import { TripStatus, UnitStatus, OperatorStatus } from "@prisma/client";

let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
let tenantB: Awaited<ReturnType<typeof createTestTenant>>;

let unitA: any;
let operatorA: any;
let routeA: any;

let unitB: any;
let operatorB: any;
let routeB: any;
let tripB: any;

beforeAll(async () => {
  await cleanupTestData();

  tenantA = await createTestTenant("A");
  tenantB = await createTestTenant("B");

  // Setup Tenant A data
  unitA = await prisma.unit.create({
    data: {
      plate: "UNIT-A",
      brand: "Kenworth",
      model: "T680",
      year: 2024,
      type: "caja_seca",
      axles: 5,
      company_id: tenantA.company.id,
      status: UnitStatus.disponible,
    },
  });

  operatorA = await prisma.operator.create({
    data: {
      name: "Operador A",
      license_number: "LIC-A",
      license_type: "B",
      license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      company_id: tenantA.company.id,
      status: OperatorStatus.disponible,
    },
  });

  routeA = await prisma.route.create({
    data: {
      name: "Ruta A",
      origin: "Ciudad A",
      destination: "Ciudad B",
      distance_km: 100,
      estimated_duration_min: 120,
      company_id: tenantA.company.id,
    },
  });

  // Setup Tenant B data for isolation tests
  unitB = await prisma.unit.create({
    data: {
      plate: "UNIT-B",
      type: "plataforma",
      axles: 3,
      company_id: tenantB.company.id,
      status: UnitStatus.disponible,
    },
  });

  operatorB = await prisma.operator.create({
    data: {
      name: "Operador B",
      license_number: "LIC-B",
      license_type: "B",
      license_expiry: new Date(),
      company_id: tenantB.company.id,
      status: OperatorStatus.disponible,
    },
  });

  routeB = await prisma.route.create({
    data: {
      name: "Ruta B",
      origin: "X",
      destination: "Y",
      distance_km: 10,
      estimated_duration_min: 10,
      company_id: tenantB.company.id,
    },
  });

  tripB = await prisma.trip.create({
    data: {
      company_id: tenantB.company.id,
      route_id: routeB.id,
      unit_id: unitB.id,
      operator_id: operatorB.id,
      scheduled_date: new Date(),
      status: TripStatus.en_curso,
    },
  });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("Trips API", () => {
  describe("POST /api/trips", () => {
    it("should create a trip and update resource statuses", async () => {
      const res = await request(app)
        .post("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          route_id: routeA.id,
          unit_id: unitA.id,
          operator_id: operatorA.id,
          scheduled_date: new Date().toISOString(),
          estimated_tollbooth_cost: 100,
          estimated_fuel_cost: 500,
          estimated_extras_cost: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe(TripStatus.en_curso);
      expect(res.body.estimated_cost).toBe(650);

      // Verify resource statuses updated
      const updatedUnit = await prisma.unit.findUnique({ where: { id: unitA.id } });
      const updatedOperator = await prisma.operator.findUnique({ where: { id: operatorA.id } });

      expect(updatedUnit?.status).toBe(UnitStatus.en_viaje);
      expect(updatedOperator?.status).toBe(OperatorStatus.en_viaje);
    });

    it("should fail if unit is not disponible", async () => {
      // unitA is now "en_viaje" from previous test
      const res = await request(app)
        .post("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          route_id: routeA.id,
          unit_id: unitA.id,
          operator_id: operatorA.id, 
          scheduled_date: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("disponible");
    });

    it("should prevent cross-tenant resource assignment", async () => {
      const res = await request(app)
        .post("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          route_id: routeA.id,
          unit_id: unitB.id, // Resource from Tenant B
          operator_id: operatorA.id,
          scheduled_date: new Date().toISOString(),
        });

      // Service should return 404 because withTenant won't find unitB in Tenant A's scope
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/trips", () => {
    it("should list trips only for the current tenant", async () => {
      const res = await request(app)
        .get("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      // We created one trip for tenantA in the first POST test
      const tenantATrips = res.body.filter((t: any) => t.company_id === tenantA.company.id);
      expect(tenantATrips.length).toBe(1);
      expect(res.body.some((t: any) => t.id === tripB.id)).toBe(false);
    });
  });

  describe("PATCH /api/trips/:id/status", () => {
    it("should update status and release resources on completion", async () => {
      const listRes = await request(app)
        .get("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`);
      const tripA = listRes.body[0];

      const res = await request(app)
        .patch(`/api/trips/${tripA.id}/status`)
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          status: TripStatus.completado,
          actual_fuel_cost: 520,
          actual_tollbooth_cost: 100,
          actual_extras_cost: 60,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(TripStatus.completado);
      expect(res.body.actual_cost).toBe(680);

      // Verify resources are free
      const updatedUnit = await prisma.unit.findUnique({ where: { id: unitA.id } });
      const updatedOperator = await prisma.operator.findUnique({ where: { id: operatorA.id } });

      expect(updatedUnit?.status).toBe(UnitStatus.disponible);
      expect(updatedOperator?.status).toBe(OperatorStatus.disponible);
    });
  });
});
