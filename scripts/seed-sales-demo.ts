/**
 * Seed del tenant de demo para el equipo de ventas (demostraciones a transportistas).
 *
 * Uso:
 *   npx tsx scripts/seed-sales-demo.ts            # crea tenant + usuario + datos (idempotente)
 *   npx tsx scripts/seed-sales-demo.ts --reset    # borra y regenera los datos del tenant
 *
 * Variables opcionales: DEMO_SALES_EMAIL, DEMO_SALES_PASSWORD.
 * Todas las escrituras de tablas del tenant pasan por withTenant() (RLS).
 */
import { PrismaClient, AppModule, Unit, Operator, Route } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma, withTenant } from "../src/lib/prisma";

// Igual que withTenant() pero con timeout amplio: el seed hace muchas
// escrituras y la DB es remota (el default de 5 s no alcanza).
const withTenantLong = <T>(companyId: string, fn: (tx: PrismaClient) => Promise<T>) =>
  prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
      return fn(tx as unknown as PrismaClient);
    },
    { timeout: 120_000, maxWait: 20_000 }
  );

const SLUG = "ventas-demo";
const COMPANY_NAME = "Transportes Demo";
const EMAIL = process.env.DEMO_SALES_EMAIL ?? "demo@ward.com";
const PASSWORD = process.env.DEMO_SALES_PASSWORD ?? "123456";
const RESET = process.argv.includes("--reset");

const MODULES: AppModule[] = [
  AppModule.inventario,
  AppModule.operaciones,
  AppModule.flotas,
  AppModule.clientes,
  AppModule.finanzas,
  AppModule.admin,
  AppModule.warden,
];

const daysFromNow = (days: number, hour = 8): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function ensureTenantAndUser() {
  const company = await prisma.company.upsert({
    where: { slug: SLUG },
    update: { active: true, subscription_status: "active", active_modules: MODULES },
    create: {
      name: COMPANY_NAME,
      slug: SLUG,
      active: true,
      subscription_status: "active",
      active_modules: MODULES,
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing && existing.company_id !== company.id) {
    throw new Error(
      `${EMAIL} ya pertenece a otro tenant (${existing.company_id}); no lo muevo.`
    );
  }

  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const user = await withTenant(company.id, (tx) =>
    tx.user.upsert({
      where: { email: EMAIL },
      update: { password_hash, active: true, role: "admin" },
      create: {
        email: EMAIL,
        name: "Demo Ventas",
        password_hash,
        role: "admin",
        active: true,
        company_id: company.id,
      },
    })
  );
  return { company, user };
}

async function wipeTenantData(tx: PrismaClient, companyId: string) {
  const where = { company_id: companyId };
  await tx.tripStatusHistory.deleteMany({ where: { trip: where } });
  await tx.trip.deleteMany({ where }); // cascada: trip_cost_details
  await tx.route.deleteMany({ where }); // cascada: route_tollbooths
  await tx.tollbooth.deleteMany({ where });
  await tx.operator.deleteMany({ where }); // cascada: operator_documents
  await tx.unit.deleteMany({ where });
  await tx.inventoryMovement.deleteMany({ where });
  await tx.material.deleteMany({ where });
  await tx.materialCategory.deleteMany({ where });
}

async function seedFleet(tx: PrismaClient, companyId: string) {
  const unitSpecs = [
    { plate: "ABC-123-A", brand: "Kenworth", model: "T680", year: 2022, type: "caja_seca", axles: 5, status: "en_viaje", km_l: 2.6 },
    { plate: "DEF-456-B", brand: "Freightliner", model: "Cascadia", year: 2021, type: "refrigerado", axles: 5, status: "en_viaje", km_l: 2.4 },
    { plate: "GHI-789-C", brand: "Volvo", model: "VNL 760", year: 2023, type: "caja_seca", axles: 5, status: "disponible", km_l: 2.8 },
    { plate: "JKL-012-D", brand: "International", model: "LT", year: 2020, type: "plataforma", axles: 6, status: "disponible", km_l: 2.3 },
    { plate: "MNO-345-E", brand: "Kenworth", model: "T880", year: 2019, type: "volteo", axles: 3, status: "mantenimiento", km_l: 2.0 },
    { plate: "PQR-678-F", brand: "Peterbilt", model: "579", year: 2022, type: "caja_seca", axles: 5, status: "disponible", km_l: 2.7 },
    { plate: "STU-901-G", brand: "Freightliner", model: "M2", year: 2021, type: "pipa", axles: 3, status: "disponible", km_l: 3.1 },
    { plate: "VWX-234-H", brand: "Volvo", model: "VNR", year: 2018, type: "otro", axles: 2, status: "inactivo", km_l: 3.4 },
  ] as const;

  const units: Unit[] = [];
  for (const [i, u] of unitSpecs.entries()) {
    units.push(
      await tx.unit.create({
        data: {
          company_id: companyId,
          plate: u.plate,
          brand: u.brand,
          model: u.model,
          year: u.year,
          type: u.type,
          axles: u.axles,
          status: u.status,
          vin: `3AKJHDDV${String(1000000 + i)}`,
          // Dos seguros próximos a vencer para mostrar alertas.
          insurance_expiry: daysFromNow(i < 2 ? 12 + i * 10 : 120 + i * 20),
          fuel_efficiency_km_l: u.km_l,
          last_maintenance_date: daysFromNow(-20 - i * 9),
        },
      })
    );
  }

  const operatorSpecs = [
    { name: "Juan Carlos Pérez", lic: "LF-0012345", type: "E", expiry: 20, status: "en_viaje" },
    { name: "Miguel Ángel Torres", lic: "LF-0023456", type: "E", expiry: 400, status: "en_viaje" },
    { name: "Roberto Hernández", lic: "LF-0034567", type: "E", expiry: 18, status: "disponible" },
    { name: "Luis Fernando Gómez", lic: "LF-0045678", type: "D", expiry: 600, status: "disponible" },
    { name: "Alejandro Ramírez", lic: "LF-0056789", type: "E", expiry: 250, status: "disponible" },
    { name: "Francisco Morales", lic: "LF-0067890", type: "C", expiry: 900, status: "no_disponible" },
  ] as const;

  const operators: Operator[] = [];
  for (const [i, o] of operatorSpecs.entries()) {
    operators.push(
      await tx.operator.create({
        data: {
          company_id: companyId,
          name: o.name,
          license_number: o.lic,
          license_type: o.type,
          license_expiry: daysFromNow(o.expiry),
          status: o.status,
          phone: `55 5000 ${String(1000 + i)}`,
          email: `operador${i + 1}@transportesdemo.mx`,
        },
      })
    );
  }
  return { units, operators };
}

async function seedRoutes(tx: PrismaClient, companyId: string) {
  const tollSpecs = [
    { name: "Caseta Tepotzotlán", base: 180 },
    { name: "Caseta Palmillas", base: 150 },
    { name: "Caseta Querétaro", base: 210 },
    { name: "Caseta Zapotlanejo", base: 260 },
    { name: "Caseta Tlalpan-Cuernavaca", base: 120 },
  ];
  const tolls: { id: string }[] = [];
  for (const t of tollSpecs) {
    tolls.push(
      await tx.tollbooth.create({
        data: {
          company_id: companyId,
          name: t.name,
          cost_2_axles: t.base,
          cost_3_axles: Math.round(t.base * 1.5),
          cost_4_axles: Math.round(t.base * 2),
          cost_5_axles: Math.round(t.base * 2.6),
          cost_6_axles: Math.round(t.base * 3.1),
          cost_7_plus_axles: Math.round(t.base * 3.6),
        },
      })
    );
  }

  const routeSpecs = [
    { name: "CDMX – Guadalajara", origin: "Ciudad de México", destination: "Guadalajara, JAL", km: 540, min: 480, tolls: [0, 1, 2, 3] },
    { name: "CDMX – Monterrey", origin: "Ciudad de México", destination: "Monterrey, NL", km: 900, min: 600, tolls: [0, 1, 2] },
    { name: "CDMX – Querétaro", origin: "Ciudad de México", destination: "Querétaro, QRO", km: 215, min: 180, tolls: [0, 1] },
    { name: "CDMX – Cuernavaca", origin: "Ciudad de México", destination: "Cuernavaca, MOR", km: 90, min: 90, tolls: [4] },
  ];
  const routes: Route[] = [];
  for (const r of routeSpecs) {
    routes.push(
      await tx.route.create({
        data: {
          company_id: companyId,
          name: r.name,
          origin: r.origin,
          destination: r.destination,
          distance_km: r.km,
          estimated_duration_min: r.min,
          route_tollbooths: {
            create: r.tolls.map((idx, order) => ({
              tollbooth_id: tolls[idx].id,
              order: order + 1,
            })),
          },
        },
      })
    );
  }
  return routes;
}

async function seedTrips(
  tx: PrismaClient,
  companyId: string,
  actorId: string,
  fleet: Awaited<ReturnType<typeof seedFleet>>,
  routes: Awaited<ReturnType<typeof seedRoutes>>
) {
  // dayOffset negativo = pasado. Estados coherentes con unidad/operador en_viaje.
  const specs = [
    { day: -28, status: "completado", r: 0, u: 2, o: 3 },
    { day: -24, status: "completado", r: 1, u: 5, o: 4 },
    { day: -21, status: "completado", r: 2, u: 3, o: 2 },
    { day: -17, status: "completado", r: 0, u: 0, o: 0 },
    { day: -14, status: "completado", r: 3, u: 6, o: 5 },
    { day: -10, status: "completado", r: 1, u: 1, o: 1 },
    { day: -7, status: "completado", r: 2, u: 2, o: 3 },
    { day: -5, status: "cancelado", r: 0, u: 5, o: 4, reason: "Cliente reprogramó la entrega" },
    { day: -2, status: "completado", r: 3, u: 3, o: 2 },
    { day: 0, status: "en_curso", r: 0, u: 0, o: 0 },
    { day: 0, status: "en_curso", r: 1, u: 1, o: 1 },
    { day: 2, status: "programado", r: 2, u: 2, o: 3 },
    { day: 4, status: "programado", r: 0, u: 5, o: 4 },
  ] as const;

  for (const s of specs) {
    const route = routes[s.r];
    const unit = fleet.units[s.u];
    const operator = fleet.operators[s.o];
    const scheduled = daysFromNow(s.day, 7);
    const estToll = Math.round(route.distance_km * 0.9);
    const estFuel = Math.round((route.distance_km / 2.6) * 24.5);
    const estimated = estToll + estFuel + 400;
    const finished = s.status === "completado";
    const started = finished || s.status === "en_curso";
    const variance = finished ? 0.93 + ((s.day * -1) % 7) * 0.02 : 1;

    const trip = await tx.trip.create({
      data: {
        company_id: companyId,
        route_id: route.id,
        unit_id: unit.id,
        operator_id: operator.id,
        status: s.status,
        scheduled_date: scheduled,
        departure_time: started ? scheduled : null,
        arrival_time: finished
          ? new Date(scheduled.getTime() + route.estimated_duration_min * 60_000)
          : null,
        estimated_cost: estimated,
        actual_cost: finished ? Math.round(estimated * variance) : null,
        cancellation_reason: "reason" in s ? s.reason : null,
        cost_detail: {
          create: {
            estimated_tollbooth_cost: estToll,
            estimated_fuel_cost: estFuel,
            estimated_extras_cost: 400,
            tollbooth_cost: finished ? Math.round(estToll * variance) : 0,
            fuel_cost: finished ? Math.round(estFuel * variance) : 0,
            extras_cost: finished ? 400 : 0,
            fuel_type: "diesel",
          },
        },
      },
    });

    const history = ["programado"];
    if (started) history.push("en_curso");
    if (finished) history.push("completado");
    if (s.status === "cancelado") history.push("cancelado");
    for (const status of history) {
      await tx.tripStatusHistory.create({
        data: {
          trip_id: trip.id,
          status: status as "programado",
          actor_id: actorId,
          cancellation_reason:
            status === "cancelado" && "reason" in s ? s.reason : null,
        },
      });
    }
  }
}

async function seedInventory(tx: PrismaClient, companyId: string, actorId: string) {
  const categoryNames = ["Llantas", "Filtros", "Balatas", "Diesel", "Lubricantes"];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const c = await tx.materialCategory.create({ data: { company_id: companyId, name } });
    categories[name] = c.id;
  }

  const materialSpecs = [
    { name: "Llanta 295/80 R22.5", sku: "LL-295", cat: "Llantas", unit: "pieza", price: 8500, min: 10, stock: 24 },
    { name: "Llanta 11R 24.5", sku: "LL-11R", cat: "Llantas", unit: "pieza", price: 7200, min: 8, stock: 6 },
    { name: "Filtro de aceite FP-123", sku: "FI-ACE", cat: "Filtros", unit: "pieza", price: 350, min: 20, stock: 45 },
    { name: "Filtro de aire FA-456", sku: "FI-AIR", cat: "Filtros", unit: "pieza", price: 520, min: 15, stock: 8 },
    { name: "Balata delantera BD-789", sku: "BA-DEL", cat: "Balatas", unit: "juego", price: 1800, min: 12, stock: 18 },
    { name: "Diesel ULSD", sku: "DI-ULS", cat: "Diesel", unit: "litro", price: 24.5, min: 5000, stock: 12000 },
    { name: "Aceite 15W-40 (cubeta 19L)", sku: "LU-15W", cat: "Lubricantes", unit: "cubeta", price: 1650, min: 6, stock: 14 },
  ];

  for (const [i, m] of materialSpecs.entries()) {
    const material = await tx.material.create({
      data: {
        company_id: companyId,
        name: m.name,
        sku: m.sku,
        category_id: categories[m.cat],
        unit: m.unit,
        reference_price: m.price,
        min_stock: m.min,
        current_stock: m.stock,
      },
    });
    // Entrada inicial + una salida reciente por material.
    const out = Math.max(1, Math.round(m.stock * 0.15));
    await tx.inventoryMovement.createMany({
      data: [
        {
          company_id: companyId,
          material_id: material.id,
          type: "entry",
          quantity: m.stock + out,
          unit_cost: m.price,
          total_cost: m.price * (m.stock + out),
          supplier: "Refaccionaria del Norte",
          invoice_number: `FAC-${1000 + i}`,
          created_by: actorId,
          movement_date: daysFromNow(-30 + i),
        },
        {
          company_id: companyId,
          material_id: material.id,
          type: "exit",
          quantity: out,
          destination: "Taller – unidad ABC-123-A",
          reason: "Mantenimiento preventivo",
          created_by: actorId,
          movement_date: daysFromNow(-3 - i),
        },
      ],
    });
  }
}

async function main() {
  const { company, user } = await ensureTenantAndUser();

  await withTenantLong(company.id, async (tx) => {
    // Valores coherentes con los costos de los viajes sembrados.
    const settings = {
      fuel_price_per_liter: 24.5,
      fuel_efficiency_km_l: 2.6,
      estimated_trips_per_month: 12,
      monthly_insurance_cost: 18500,
    };
    await tx.tenantSettings.upsert({
      where: { company_id: company.id },
      update: settings,
      create: { company_id: company.id, ...settings },
    });

    const unitCount = await tx.unit.count({ where: { company_id: company.id } });
    if (unitCount > 0 && !RESET) {
      console.log("El tenant ya tiene datos; usa --reset para regenerarlos.");
      return;
    }
    if (RESET) await wipeTenantData(tx, company.id);

    const fleet = await seedFleet(tx, company.id);
    const routes = await seedRoutes(tx, company.id);
    await seedTrips(tx, company.id, user.id, fleet, routes);
    await seedInventory(tx, company.id, user.id);
    console.log("Datos de demo generados.");
  });

  console.log(`Tenant: ${company.name} (${company.slug})  id=${company.id}`);
  console.log(`Usuario: ${EMAIL}  rol=${user.role}`);
  console.log(`Módulos: ${MODULES.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
