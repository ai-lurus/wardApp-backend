import request from "supertest";
import app from "../../src/server";
import { prisma } from "../../src/lib/prisma";
import { createTestTenant, cleanupTestData } from "./helpers/setup";

let tenantA: Awaited<ReturnType<typeof createTestTenant>>;
let tenantB: Awaited<ReturnType<typeof createTestTenant>>;
let materialA: any;
let materialB: any;

beforeAll(async () => {
  await cleanupTestData();

  tenantA = await createTestTenant("A");
  tenantB = await createTestTenant("B");

  // Create material for Tenant A
  const categoryA = await prisma.materialCategory.create({
    data: {
      name: "Category A",
      company_id: tenantA.company.id,
    },
  });

  materialA = await prisma.material.create({
    data: {
      name: "Material A",
      unit: "pieza",
      company_id: tenantA.company.id,
      category_id: categoryA.id,
      min_stock: 5,
      current_stock: 10,
    },
  });

  // Create material for Tenant B
  const categoryB = await prisma.materialCategory.create({
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
      category_id: categoryB.id,
      min_stock: 5,
      current_stock: 20,
    },
  });
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe("Ward.io Inventory & Auth Flow Integration Tests", () => {
  describe("Authentication (Login API)", () => {
    it("should return 401 for invalid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: tenantA.user.email,
          password: "WrongPassword123!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it("should return 200 and a JWT token for valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: tenantA.user.email,
          password: "TestPass123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(tenantA.user.email);
    });
  });

  describe("Inventory Movement Flow", () => {
    it("should register an entry and increase material current_stock", async () => {
      const entryQty = 5;
      const res = await request(app)
        .post("/api/inventory/entry")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          material_id: materialA.id,
          quantity: entryQty,
          unit_cost: 150,
          supplier: "Proveedor Central",
          invoice_number: "INV-100",
          notes: "Entrada de prueba",
        });

      expect(res.status).toBe(201);
      expect(res.body.material_id).toBe(materialA.id);
      expect(res.body.quantity).toBe(entryQty);
      expect(res.body.type).toBe("entry");

      // Verify DB updated stock
      const updatedMaterial = await prisma.material.findUnique({
        where: { id: materialA.id },
      });
      expect(updatedMaterial?.current_stock).toBe(15); // Starting (10) + Entry (5)
    });

    it("should register an exit and decrease material current_stock", async () => {
      const exitQty = 3;
      const res = await request(app)
        .post("/api/inventory/exit")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          material_id: materialA.id,
          quantity: exitQty,
          destination: "Taller Principal",
          reason: "Uso interno de mantenimiento",
        });

      expect(res.status).toBe(201);
      expect(res.body.material_id).toBe(materialA.id);
      expect(res.body.quantity).toBe(exitQty);
      expect(res.body.type).toBe("exit");

      // Verify DB updated stock
      const updatedMaterial = await prisma.material.findUnique({
        where: { id: materialA.id },
      });
      expect(updatedMaterial?.current_stock).toBe(12); // Previous (15) - Exit (3)
    });

    it("should fail to register exit if quantity exceeds current_stock", async () => {
      const excessQty = 50;
      const res = await request(app)
        .post("/api/inventory/exit")
        .set("Authorization", `Bearer ${tenantA.token}`)
        .send({
          material_id: materialA.id,
          quantity: excessQty,
          reason: "Exceso de stock",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Insufficient stock");

      // Verify DB stock remains unchanged
      const updatedMaterial = await prisma.material.findUnique({
        where: { id: materialA.id },
      });
      expect(updatedMaterial?.current_stock).toBe(12); // Unchanged from 12
    });
  });

  describe("Multitenancy Stock Isolation", () => {
    it("should return 404 and block Tenant B from registering an entry on Tenant A's material", async () => {
      const res = await request(app)
        .post("/api/inventory/entry")
        .set("Authorization", `Bearer ${tenantB.token}`)
        .send({
          material_id: materialA.id,
          quantity: 5,
        });

      expect(res.status).toBe(404);

      // Verify DB stock of material A remains unchanged
      const updatedMaterialA = await prisma.material.findUnique({
        where: { id: materialA.id },
      });
      expect(updatedMaterialA?.current_stock).toBe(12);
    });

    it("should return 404 and block Tenant B from registering an exit on Tenant A's material", async () => {
      const res = await request(app)
        .post("/api/inventory/exit")
        .set("Authorization", `Bearer ${tenantB.token}`)
        .send({
          material_id: materialA.id,
          quantity: 2,
        });

      expect(res.status).toBe(404);

      // Verify DB stock of material A remains unchanged
      const updatedMaterialA = await prisma.material.findUnique({
        where: { id: materialA.id },
      });
      expect(updatedMaterialA?.current_stock).toBe(12);
    });

    it("should return empty or isolated movements history for Tenant A", async () => {
      const res = await request(app)
        .get("/api/inventory/movements")
        .set("Authorization", `Bearer ${tenantA.token}`);

      expect(res.status).toBe(200);
      const items = res.body.items || res.body.data || res.body;
      expect(Array.isArray(items)).toBe(true);
      // Tenant A should only see movements belonging to Tenant A's company
      items.forEach((movement: any) => {
        expect(movement.company_id).toBe(tenantA.company.id);
        expect(movement.company_id).not.toBe(tenantB.company.id);
      });
    });
  });
});
