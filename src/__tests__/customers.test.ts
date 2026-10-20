import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/server";
import { prisma } from "../../src/lib/prisma";
import { env } from "./helpers/setupEnv";
import { createTestTenant, cleanupTestData } from "./helpers/setup";
import { TripStatus, UnitStatus, OperatorStatus } from "@prisma/client";

let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
let tenantB: Awaited<ReturnType<typeof createTestTenant>>;

let unitA: any;
let operatorA: any;
let routeA: any;

let customerA: any;
let frequentCustomerA: any;
let customerB: any;
let tripA: any;

beforeAll(async () => {
  await cleanupTestData();

  tenantA = await createTestTenant("A");
  tenantB = await createTestTenant("B");

  unitA = await prisma.unit.create({
    data: {
      plate: "CUST-UNIT-A",
      type: "caja_seca",
      axles: 5,
      company_id: tenantA.company.id,
      status: UnitStatus.disponible,
    },
  });

  operatorA = await prisma.operator.create({
    data: {
      name: "Operador A",
      license_number: "CUST-LIC-A",
      license_type: "B",
      license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      company_id: tenantA.company.id,
      status: OperatorStatus.disponible,
    },
  });

  routeA = await prisma.route.create({
    data: {
      name: "Ruta A",
      origin: "Monterrey",
      destination: "Saltillo",
      distance_km: 90,
      estimated_duration_min: 90,
      company_id: tenantA.company.id,
    },
  });

  // Customer with several historical trips, used to check report ordering
  frequentCustomerA = await prisma.customer.create({
    data: { name: "Cliente Frecuente", phone: "8110000000", company_id: tenantA.company.id },
  });

  const historicTrip = {
    company_id: tenantA.company.id,
    route_id: routeA.id,
    unit_id: unitA.id,
    operator_id: operatorA.id,
    customer_id: frequentCustomerA.id,
    scheduled_date: new Date("2026-01-15T10:00:00.000Z"),
  };
  await prisma.trip.createMany({
    data: [
      { ...historicTrip, status: TripStatus.completado, entry_cost: 2000, actual_cost: 1500 },
      { ...historicTrip, status: TripStatus.completado, entry_cost: 3000, actual_cost: 2000 },
      { ...historicTrip, status: TripStatus.programado },
      // Cancelled trips count neither for frequency nor for money
      { ...historicTrip, status: TripStatus.cancelado, entry_cost: 9999, actual_cost: 1 },
    ],
  });

  customerB = await prisma.customer.create({
    data: { name: "Cliente B", phone: "5550000000", company_id: tenantB.company.id },
  });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("Customers API", () => {
  describe("POST /api/customers", () => {
    it("creates a customer and normalizes an empty email to null", async () => {
      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ name: "Transportes Norte", phone: "8112345678", email: "" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Transportes Norte");
      expect(res.body.email).toBeNull();
      expect(res.body.company_id).toBe(tenantA.company.id);
      customerA = res.body;
    });

    it("requires name and phone", async () => {
      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ name: "Sin teléfono" });

      expect(res.status).toBe(400);
    });

    it("rejects an invalid email", async () => {
      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ name: "X", phone: "1", email: "no-es-correo" });

      expect(res.status).toBe(400);
    });

    it("only allows admins to write", async () => {
      const nonAdminToken = jwt.sign(
        { userId: tenantA.user.id, role: "almacenista", companyId: tenantA.company.id },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${nonAdminToken}`)
        .send({ name: "No permitido", phone: "1" });

      expect(res.status).toBe(403);

      // Reads are still allowed
      const list = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${nonAdminToken}`);
      expect(list.status).toBe(200);
    });
  });

  describe("tenant isolation", () => {
    it("does not list other tenants' customers", async () => {
      const res = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.some((c: any) => c.id === customerB.id)).toBe(false);
      expect(res.body.some((c: any) => c.id === customerA.id)).toBe(true);
    });

    it("returns 404 for another tenant's customer on GET, PUT and DELETE", async () => {
      const auth = { Authorization: `Bearer ${tenantA.token}` };

      const getRes = await request(app).get(`/api/customers/${customerB.id}`).set(auth);
      const putRes = await request(app).put(`/api/customers/${customerB.id}`).set(auth).send({ name: "Hack" });
      const delRes = await request(app).delete(`/api/customers/${customerB.id}`).set(auth);

      expect(getRes.status).toBe(404);
      expect(putRes.status).toBe(404);
      expect(delRes.status).toBe(404);

      const untouched = await prisma.customer.findUnique({ where: { id: customerB.id } });
      expect(untouched?.name).toBe("Cliente B");
      expect(untouched?.deleted_at).toBeNull();
    });

    it("rejects linking a trip to another tenant's customer", async () => {
      const res = await request(app)
        .post("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          route_id: routeA.id,
          unit_id: unitA.id,
          operator_id: operatorA.id,
          customer_id: customerB.id,
          scheduled_date: new Date().toISOString(),
        });

      expect(res.status).toBe(404);

      // Resources must not be left locked by the failed creation
      const unit = await prisma.unit.findUnique({ where: { id: unitA.id } });
      expect(unit?.status).toBe(UnitStatus.disponible);
    });
  });

  describe("linking trips and finances", () => {
    it("creates a trip linked to a customer", async () => {
      const res = await request(app)
        .post("/api/trips")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          route_id: routeA.id,
          unit_id: unitA.id,
          operator_id: operatorA.id,
          customer_id: customerA.id,
          scheduled_date: new Date("2026-03-10T10:00:00.000Z").toISOString(),
          entry_cost: 1200,
          estimated_fuel_cost: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.customer_id).toBe(customerA.id);
      expect(res.body.customer.name).toBe("Transportes Norte");
      tripA = res.body;
    });

    it("persists the revenue (entry_cost) when completing a trip", async () => {
      const auth = { Authorization: `Bearer ${tenantA.token}` };

      const start = await request(app)
        .patch(`/api/trips/${tripA.id}/status`)
        .set(auth)
        .send({ status: TripStatus.en_curso });
      expect(start.status).toBe(200);

      const res = await request(app)
        .patch(`/api/trips/${tripA.id}/completed`)
        .set(auth)
        .send({
          actual_tollbooth_cost: 100,
          actual_fuel_cost: 450,
          actual_extras_cost: 50,
          entry_cost: 1000,
        });

      expect(res.status).toBe(200);
      expect(res.body.actual_cost).toBe(600);
      expect(res.body.entry_cost).toBe(1000);

      const history = await prisma.tripStatusHistory.findMany({ where: { trip_id: tripA.id } });
      expect(history.every((h) => h.actor_id === tenantA.user.id)).toBe(true);
    });

    it("returns the customer's finances and trips", async () => {
      const res = await request(app)
        .get(`/api/customers/${customerA.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toMatchObject({
        trip_count: 1,
        completed_count: 1,
        revenue: 1000,
        cost: 600,
        profit: 400,
        margin: 40,
      });
      expect(res.body.trips).toHaveLength(1);
      expect(res.body.trips[0].id).toBe(tripA.id);
    });

    it("can unassign and reassign the customer of a trip", async () => {
      const auth = { Authorization: `Bearer ${tenantA.token}` };

      const unassign = await request(app)
        .patch(`/api/trips/${tripA.id}/customer`)
        .set(auth)
        .send({ customer_id: null });
      expect(unassign.status).toBe(200);
      expect(unassign.body.customer_id).toBeNull();

      const foreign = await request(app)
        .patch(`/api/trips/${tripA.id}/customer`)
        .set(auth)
        .send({ customer_id: customerB.id });
      expect(foreign.status).toBe(404);

      const reassign = await request(app)
        .patch(`/api/trips/${tripA.id}/customer`)
        .set(auth)
        .send({ customer_id: customerA.id });
      expect(reassign.status).toBe(200);
      expect(reassign.body.customer_id).toBe(customerA.id);
    });

    it("filters trips by customer", async () => {
      const res = await request(app)
        .get(`/api/trips?customer_id=${customerA.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.map((t: any) => t.id)).toEqual([tripA.id]);
    });
  });

  describe("GET /api/customers/report", () => {
    it("aggregates frequency, revenue and profit, most frequent first", async () => {
      const res = await request(app)
        .get("/api/customers/report")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.map((i: any) => i.customer_id)).toEqual([frequentCustomerA.id, customerA.id]);

      expect(res.body.items[0]).toMatchObject({
        trip_count: 3,
        completed_count: 2,
        revenue: 5000,
        cost: 3500,
        profit: 1500,
        margin: 30,
      });

      expect(res.body.totals).toMatchObject({
        customers_with_trips: 2,
        trip_count: 4,
        completed_count: 3,
        revenue: 6000,
        cost: 4100,
        profit: 1900,
      });
    });

    it("filters by date range", async () => {
      const res = await request(app)
        .get("/api/customers/report")
        .query({ from_date: "2026-03-01T00:00:00.000Z", to_date: "2026-03-31T23:59:59.000Z" })
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.map((i: any) => i.customer_id)).toEqual([customerA.id]);
    });

    it("keeps soft-deleted customers in the report but not in the list", async () => {
      const auth = { Authorization: `Bearer ${tenantA.token}` };

      const del = await request(app).delete(`/api/customers/${frequentCustomerA.id}`).set(auth);
      expect(del.status).toBe(204);

      const list = await request(app).get("/api/customers").set(auth);
      expect(list.body.some((c: any) => c.id === frequentCustomerA.id)).toBe(false);

      const report = await request(app).get("/api/customers/report").set(auth);
      const deleted = report.body.items.find((i: any) => i.customer_id === frequentCustomerA.id);
      expect(deleted.active).toBe(false);
    });
  });
});
