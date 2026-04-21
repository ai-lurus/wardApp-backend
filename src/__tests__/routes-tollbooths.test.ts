import request from "supertest";
import app from "../../src/server";
import { prisma } from "../../src/lib/prisma";
import { createTestTenant, cleanupTestData } from "./helpers/setup";

let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
let tenantB: Awaited<ReturnType<typeof createTestTenant>>;

let tollboothB: any;
let routeB: any;

beforeAll(async () => {
  await cleanupTestData();

  tenantA = await createTestTenant("A");
  tenantB = await createTestTenant("B");

  // Create data for Tenant B using Prisma directly to test isolation
  tollboothB = await prisma.tollbooth.create({
    data: {
      name: "Caseta Tenant B",
      company_id: tenantB.company.id,
      cost_2_axles: 100,
      cost_3_axles: 150,
      cost_4_axles: 200,
      cost_5_axles: 250,
      cost_6_axles: 300,
      cost_7_plus_axles: 350,
    },
  });

  routeB = await prisma.route.create({
    data: {
      name: "Ruta Tenant B",
      company_id: tenantB.company.id,
      origin: "Origen B",
      destination: "Destino B",
      distance_km: 100,
      estimated_duration_min: 60,
    },
  });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("Routes and Tollbooths API", () => {
  describe("Tollbooths (Casetas)", () => {
    it("should create a new tollbooth for Tenant A", async () => {
      const res = await request(app)
        .post("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Caseta A1",
          cost_2_axles: 50.5,
          cost_3_axles: 75,
          cost_4_axles: 100,
          cost_5_axles: 125.5,
          cost_6_axles: 150,
          cost_7_plus_axles: 200,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Caseta A1");
      expect(res.body.cost_2_axles).toBe(50.5);
      expect(res.body.id).toBeDefined();
    });

    it("should list tollbooths only for Tenant A", async () => {
      const res = await request(app)
        .get("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Should see Caseta A1 but NOT Caseta Tenant B
      expect(res.body.some((t: any) => t.name === "Caseta A1")).toBe(true);
      expect(res.body.some((t: any) => t.id === tollboothB.id)).toBe(false);
    });

    it("should return 404 when Tenant A tries to access Tenant B's tollbooth", async () => {
      const res = await request(app)
        .get(`/api/tollbooths/${tollboothB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(404);
    });

    it("should update a tollbooth for Tenant A", async () => {
      // First get an ID from Tenant A
      const listRes = await request(app)
        .get("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`);
      const tollboothA = listRes.body.find((t: any) => t.name === "Caseta A1");

      const res = await request(app)
        .put(`/api/tollbooths/${tollboothA.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ name: "Caseta A1 Updated", cost_2_axles: 60 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Caseta A1 Updated");
      expect(res.body.cost_2_axles).toBe(60);
    });

    it("should soft delete (deactivate) a tollbooth", async () => {
      const listRes = await request(app)
        .get("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`);
      const tollboothA = listRes.body.find((t: any) => t.name === "Caseta A1 Updated");

      const res = await request(app)
        .delete(`/api/tollbooths/${tollboothA.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
    });
  });

  describe("Routes (Rutas)", () => {
    let routeAId: string;

    it("should create a new route for Tenant A", async () => {
      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Ruta A1",
          origin: "Ciudad A",
          destination: "Ciudad B",
          distance_km: 150.5,
          estimated_duration_min: 120,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Ruta A1");
      expect(res.body.id).toBeDefined();
      routeAId = res.body.id;
    });

    it("should list routes only for Tenant A", async () => {
      const res = await request(app)
        .get("/api/routes")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: any) => r.id === routeAId)).toBe(true);
      expect(res.body.some((r: any) => r.id === routeB.id)).toBe(false);
    });

    it("should return 404 when Tenant A tries to access Tenant B's route", async () => {
      const res = await request(app)
        .get(`/api/routes/${routeB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(404);
    });

    it("should create a route with associated tollbooths", async () => {
      // Create another tollbooth for A
      const tbRes = await request(app)
        .post("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Caseta para Ruta",
          cost_2_axles: 100,
          cost_3_axles: 100,
          cost_4_axles: 100,
          cost_5_axles: 100,
          cost_6_axles: 100,
          cost_7_plus_axles: 100,
        });
      const tollboothId = tbRes.body.id;

      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Ruta con Casetas",
          origin: "Origen X",
          destination: "Destino Y",
          distance_km: 200,
          estimated_duration_min: 180,
          tollbooths: [
            { id: tollboothId, order: 1 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.tollbooths).toBeDefined();
      expect(res.body.tollbooths.length).toBe(1);
      expect(res.body.tollbooths[0].id).toBe(tollboothId);
    });

    it("should fail to create a route with a tollbooth that belongs to another tenant", async () => {
      const res = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Ruta Ilegal",
          origin: "A",
          destination: "B",
          distance_km: 10,
          estimated_duration_min: 10,
          tollbooths: [
            { id: tollboothB.id, order: 1 }
          ]
        });

      // Based on typical service implementation, this should fail because it won't find the tollbooth
      // or it will violate FK if isolation is handled at service level
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Cost Engine", () => {
    it("should calculate correct cost preview for a route", async () => {
      // 1. Create 2 tollbooths for Tenant A
      const tb1 = await request(app)
        .post("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "TB 1",
          cost_2_axles: 50,
          cost_3_axles: 60,
          cost_4_axles: 70,
          cost_5_axles: 80,
          cost_6_axles: 90,
          cost_7_plus_axles: 100,
        });
      
      const tb2 = await request(app)
        .post("/api/tollbooths")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "TB 2",
          cost_2_axles: 100,
          cost_3_axles: 120,
          cost_4_axles: 140,
          cost_5_axles: 160,
          cost_6_axles: 180,
          cost_7_plus_axles: 200,
        });

      // 2. Create a route with these tollbooths
      const routeRes = await request(app)
        .post("/api/routes")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          name: "Ruta Costosa",
          origin: "A",
          destination: "B",
          distance_km: 100,
          estimated_duration_min: 60,
          tollbooths: [
            { id: tb1.body.id, order: 1 },
            { id: tb2.body.id, order: 2 }
          ]
        });
      const routeId = routeRes.body.id;

      // 3. Request cost preview for 5 axles
      // tb1 (80) + tb2 (160) = 240
      const res5 = await request(app)
        .get(`/api/routes/${routeId}/cost-preview?axles=5`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res5.status).toBe(200);
      expect(res5.body.total_cost).toBe(240);

      // 4. Request cost preview for 2 axles
      // tb1 (50) + tb2 (100) = 150
      const res2 = await request(app)
        .get(`/api/routes/${routeId}/cost-preview?axles=2`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.total_cost).toBe(150);
    });
  });
});
