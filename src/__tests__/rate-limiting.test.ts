import request from "supertest";
import app from "../../src/server";
import { prisma } from "../../src/lib/prisma";
import { createTestTenant, cleanupTestData } from "./helpers/setup";

let tenant: Awaited<ReturnType<typeof createTestTenant>>;

beforeAll(async () => {
  await cleanupTestData();
  tenant = await createTestTenant("rate");
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.loginAttempt.deleteMany();
  await prisma.securityLog.deleteMany();
  await prisma.$disconnect();
});

describe("Rate Limiting & Security", () => {
    beforeEach(async () => {
        await prisma.loginAttempt.deleteMany();
        await prisma.securityLog.deleteMany();
    });

    it("debería bloquear la cuenta por 30s despues de 3 intentos fallidos", async () => {
        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    email: tenant.user.email,
                    password: "wrong_password"
                });
            expect(res.status).toBe(401);
        }

        const resLocked = await request(app)
            .post("/api/auth/login")
            .send({
                email: tenant.user.email,
                password: "wrong_password"
            });
        
        expect(resLocked.status).toBe(429);
        expect(resLocked.body.error).toContain("Demasiados intentos fallidos");

        const attempt = await prisma.loginAttempt.findFirst({
            where: { email: tenant.user.email }
        });
        expect(attempt?.attempts).toBe(3);
    });

    it("debería escalar el bloqueo y crear un SecurityLog despues de 6 fallos", async () => {
        await prisma.loginAttempt.create({
            data: {
                ip: "::ffff:127.0.0.1",
                email: tenant.user.email,
                attempts: 5,
            }
        });

        // Este será el 6to fallo validando que la contraseña es mala
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: tenant.user.email,
                password: "wrong_password"
            });
        expect(res.status).toBe(401);

        // Este 7mo debe rebotar desde el middleware informando del límite de 429
        const resLocked = await request(app)
            .post("/api/auth/login")
            .send({
                email: tenant.user.email,
                password: "wrong_password"
            });
        expect(resLocked.status).toBe(429);

        // Corroborar Log
        const logs = await prisma.securityLog.findMany({
            where: { email: tenant.user.email }
        });
        expect(logs.length).toBe(1);
        expect(logs[0].event_type).toBe("BRUTE_FORCE_LOCK");
    });
    
    it("debería reiniciar los intentos tras un login exitoso", async () => {
        await request(app)
            .post("/api/auth/login")
            .send({
                email: tenant.user.email,
                password: "wrong_password"
            });
            
        let attempt = await prisma.loginAttempt.findFirst({
             where: { email: tenant.user.email }
        });
        expect(attempt?.attempts).toBe(1);
        
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: tenant.user.email,
                password: "TestPass123!" // Contraseña por defecto creada en createTestTenant
            });
            
        expect(res.status).toBe(200);
        
        // Corroborar redención
        attempt = await prisma.loginAttempt.findFirst({
             where: { email: tenant.user.email }
        });
        expect(attempt).toBeNull();
    });
});

