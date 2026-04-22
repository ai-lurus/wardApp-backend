import request from "supertest";
import app from "../../src/server";
import { prisma, withTenant } from "../../src/lib/prisma";
import { createTestTenant, cleanupTestData } from "./helpers/setup";

let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
let tenantB: Awaited<ReturnType<typeof createTestTenant>>;

let materialCategoryB: any;
let materialB: any;
let unitB: any;
let inventoryMovementB: any;

beforeAll(async () => {
  await cleanupTestData();

  tenantA = await createTestTenant("A");
  tenantB = await createTestTenant("B");

  // Create data for Tenant B using Prisma directly
  materialCategoryB = await prisma.materialCategory.create({
    data: {
      name: "Category B",
      company_id: tenantB.company.id,
    },
  });

  materialB = await prisma.material.create({
    data: {
      name: "Material B",
      unit: "pieza",
      company_id: tenantB.company.id,
      category_id: materialCategoryB.id,
      min_stock: 0,
      current_stock: 10,
    },
  });

  unitB = await prisma.unit.create({
    data: {
      plate: "B-1234",
      type: "caja_seca",
      axles: 2,
      company_id: tenantB.company.id,
    },
  });

  inventoryMovementB = await prisma.inventoryMovement.create({
    data: {
      company_id: tenantB.company.id,
      material_id: materialB.id,
      type: "entry",
      quantity: 10,
      created_by: tenantB.user.id,
    },
  });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("Tenant Isolation", () => {
  describe("Material", () => {
    it("should return 401 if no Authorization header is provided", async () => {
      const res = await request(app).get("/api/materials");
      expect(res.status).toBe(401);
    });

    it("should not return Tenant B's materials to Tenant A", async () => {
      const res = await request(app)
        .get("/api/materials")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const materials = res.body.items || res.body.data || res.body;
      expect(Array.isArray(materials)).toBe(true);
      if (materials.length > 0) {
        expect(materials.every((m: any) => m.company_id !== tenantB.company.id)).toBe(true);
      }
    });

    it("should return 404 when accessing Tenant B's material with Tenant A token", async () => {
      const res = await request(app)
        .get(`/api/materials/${materialB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(404);
    });

    it("should return 404 when updating Tenant B's material with Tenant A token", async () => {
      const res = await request(app)
        .put(`/api/materials/${materialB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ name: "Hacked Material" });

      expect(res.status).toBe(404);
    });
  });

  describe("Unit", () => {
    it("should return 401 if no Authorization header is provided", async () => {
      const res = await request(app).get("/api/units");
      expect(res.status).toBe(401);
    });

    it("should not return Tenant B's units to Tenant A", async () => {
      const res = await request(app)
        .get("/api/units")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const units = res.body.items || res.body.data || res.body;
      expect(Array.isArray(units)).toBe(true);
      if (units.length > 0) {
        expect(units.every((u: any) => u.company_id !== tenantB.company.id)).toBe(true);
      }
    });

    it("should return 404 when accessing Tenant B's unit with Tenant A token", async () => {
      const res = await request(app)
        .get(`/api/units/${unitB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(404);
    });

    it("should return 404 when updating Tenant B's unit with Tenant A token", async () => {
      const res = await request(app)
        .put(`/api/units/${unitB.id}`)
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ status: "mantenimiento" });

      expect(res.status).toBe(404);
    });
  });

  describe("InventoryMovement", () => {
    it("should return 401 if no Authorization header is provided", async () => {
      const res = await request(app).get("/api/inventory/movements");
      expect(res.status).toBe(401);
    });

    it("should not return Tenant B's movements to Tenant A", async () => {
      const res = await request(app)
        .get("/api/inventory/movements")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const movements = res.body.items || res.body.data || res.body;
      expect(Array.isArray(movements)).toBe(true);
      if (movements.length > 0) {
        expect(movements.every((m: any) => m.company_id !== tenantB.company.id)).toBe(true);
      }
    });

    it("should return 404 when adding an entry to Tenant B's material with Tenant A token", async () => {
      const res = await request(app)
        .post("/api/inventory/entry")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ material_id: materialB.id, quantity: 5 });

      // Note: service uses materialService.getMaterial so it should throw 404 if isolation works
      expect(res.status).toBe(404);
    });

    it("should return 404 when adding an exit to Tenant B's material with Tenant A token", async () => {
      const res = await request(app)
        .post("/api/inventory/exit")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({ material_id: materialB.id, quantity: 2 });

      expect(res.status).toBe(404);
    });
  });

  describe("withTenant Prisma Extension", () => {
    it("should return an empty array and not expose data for an invalid company_id", async () => {
      const fakedUUID = "11111111-1111-1111-1111-111111111111";
      const result = await withTenant(fakedUUID, async (tx) => {
        return tx.material.findMany();
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
