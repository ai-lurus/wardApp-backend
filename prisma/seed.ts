import { PrismaClient, MovementType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  // Create Demo Company
  const demoCompany = await prisma.company.upsert({
    where: { slug: "demo-corp" },
    update: {},
    create: {
      name: "Demo Corporation",
      slug: "demo-corp",
      active: true,
      active_modules: ["inventario", "operaciones", "flotas"],
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash("demo123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      password_hash: passwordHash,
      name: "Admin Demo",
      role: "admin",
      company_id: demoCompany.id,
    },
  });

  console.log("Created admin user:", admin.email);

  // Create demo almacenista user
  const almacenistaHash = await bcrypt.hash("demo123", 10);
  await prisma.user.upsert({
    where: { email: "almacenista@demo.com" },
    update: {},
    create: {
      email: "almacenista@demo.com",
      password_hash: almacenistaHash,
      name: "Carlos Almacén",
      role: "almacenista",
      company_id: demoCompany.id,
    },
  });

  console.log("Created almacenista user: almacenista@demo.com");

  // Create categories
  const categoryNames = [
    { name: "Llantas", description: "Neumaticos y llantas para unidades" },
    { name: "Filtros", description: "Filtros de aceite, aire y combustible" },
    { name: "Balatas", description: "Balatas y sistema de frenos" },
    { name: "Diesel", description: "Combustible diesel" },
    { name: "Empaques", description: "Empaques y juntas" },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryNames) {
    const created = await prisma.materialCategory.upsert({
      where: { company_id_name: { company_id: demoCompany.id, name: cat.name } },
      update: {},
      create: { ...cat, company_id: demoCompany.id },
    });
    categories[cat.name] = created.id;
  }

  console.log("Created categories:", Object.keys(categories).join(", "));

  // Create materials (skip if already seeded)
  const existingMaterialCount = await prisma.material.count();
  if (existingMaterialCount === 0) {
    const materials = [
      { name: "Llanta 295/80 R22.5",   category: "Llantas",  unit: "pieza",  reference_price: 8500,  min_stock: 10,   current_stock: 24    },
      { name: "Llanta 11R 24.5",        category: "Llantas",  unit: "pieza",  reference_price: 7200,  min_stock: 8,    current_stock: 12    },
      { name: "Filtro de aceite FP-123",category: "Filtros",  unit: "pieza",  reference_price: 350,   min_stock: 20,   current_stock: 45    },
      { name: "Filtro de aire FA-456",  category: "Filtros",  unit: "pieza",  reference_price: 520,   min_stock: 15,   current_stock: 8     },
      { name: "Balata delantera BD-789",category: "Balatas",  unit: "juego",  reference_price: 1800,  min_stock: 12,   current_stock: 18    },
      { name: "Diesel ULSD",            category: "Diesel",   unit: "litro",  reference_price: 24.5,  min_stock: 5000, current_stock: 12000 },
      { name: "Empaque multiple EM-101",category: "Empaques", unit: "pieza",  reference_price: 280,   min_stock: 10,   current_stock: 5     },
    ];

    for (const mat of materials) {
      await prisma.material.create({
        data: {
          company_id: demoCompany.id,
          name: mat.name,
          category_id: categories[mat.category],
          unit: mat.unit,
          reference_price: mat.reference_price,
          min_stock: mat.min_stock,
          current_stock: mat.current_stock,
        },
      });
    }
    console.log(`Created ${materials.length} materials`);
  } else {
    console.log(`Materials already seeded (${existingMaterialCount} found), skipping`);
  }

  // Load material IDs by name
  const allMaterials = await prisma.material.findMany({ select: { id: true, name: true } });
  const matId = Object.fromEntries(allMaterials.map((m) => [m.name, m.id]));

  // Seed demo movements (skip if already seeded beyond the initial 1)
  const existingMovementCount = await prisma.inventoryMovement.count();
  if (existingMovementCount > 5) {
    console.log(`Movements already seeded (${existingMovementCount} found), skipping`);
    return;
  }

  // Delete any stale single movement so we start clean
  await prisma.inventoryMovement.deleteMany({});

  // Historical movements — dates spread over last ~90 days
  // current_stock is already set on materials; movements are for reporting/charts only
  const movements: Array<{
    material: string;
    type: MovementType;
    quantity: number;
    unit_cost?: number;
    supplier?: string;
    invoice_number?: string;
    destination?: string;
    reason?: string;
    notes?: string;
    daysAgo: number;
  }> = [
    // === Llantas 295/80 R22.5 ===
    { material: "Llanta 295/80 R22.5", type: "entry", quantity: 30, unit_cost: 8500, supplier: "Llantera del Norte", invoice_number: "LN-2024-0891", daysAgo: 88 },
    { material: "Llanta 295/80 R22.5", type: "exit",  quantity: 4,  destination: "Unidad 14", reason: "Cambio por desgaste", daysAgo: 75 },
    { material: "Llanta 295/80 R22.5", type: "exit",  quantity: 6,  destination: "Unidad 07 / 22", reason: "Cambio preventivo", daysAgo: 60 },
    { material: "Llanta 295/80 R22.5", type: "entry", quantity: 20, unit_cost: 8700, supplier: "Llantera del Norte", invoice_number: "LN-2024-1102", daysAgo: 45 },
    { material: "Llanta 295/80 R22.5", type: "exit",  quantity: 8,  destination: "Unidad 03 / 19 / 31", reason: "Cambio por desgaste", daysAgo: 28 },
    { material: "Llanta 295/80 R22.5", type: "exit",  quantity: 8,  destination: "Unidad 08 / 25", reason: "Cambio correctivo", daysAgo: 10 },

    // === Llanta 11R 24.5 ===
    { material: "Llanta 11R 24.5", type: "entry", quantity: 20, unit_cost: 7200, supplier: "Distribuidora Omega", invoice_number: "OM-881", daysAgo: 80 },
    { material: "Llanta 11R 24.5", type: "exit",  quantity: 4,  destination: "Unidad 02", reason: "Cambio por desgaste", daysAgo: 55 },
    { material: "Llanta 11R 24.5", type: "exit",  quantity: 4,  destination: "Unidad 11", reason: "Cambio por desgaste", daysAgo: 20 },

    // === Filtro de aceite FP-123 ===
    { material: "Filtro de aceite FP-123", type: "entry", quantity: 50, unit_cost: 340, supplier: "Refacciones Martínez", invoice_number: "RM-5531", daysAgo: 85 },
    { material: "Filtro de aceite FP-123", type: "exit",  quantity: 12, destination: "Mantenimiento general", reason: "Servicio 5,000 km", daysAgo: 70 },
    { material: "Filtro de aceite FP-123", type: "entry", quantity: 30, unit_cost: 355, supplier: "Refacciones Martínez", invoice_number: "RM-5789", daysAgo: 50 },
    { material: "Filtro de aceite FP-123", type: "exit",  quantity: 15, destination: "Mantenimiento general", reason: "Servicio 5,000 km", daysAgo: 35 },
    { material: "Filtro de aceite FP-123", type: "exit",  quantity: 8,  destination: "Taller externo", reason: "Servicio correctivo", daysAgo: 8 },

    // === Filtro de aire FA-456 (stock bajo — min 15, actual 8) ===
    { material: "Filtro de aire FA-456", type: "entry", quantity: 25, unit_cost: 510, supplier: "Refacciones Martínez", invoice_number: "RM-5532", daysAgo: 84 },
    { material: "Filtro de aire FA-456", type: "exit",  quantity: 8,  destination: "Mantenimiento preventivo", reason: "Servicio programado", daysAgo: 50 },
    { material: "Filtro de aire FA-456", type: "exit",  quantity: 9,  destination: "Mantenimiento correctivo", reason: "Filtro dañado", daysAgo: 15 },

    // === Balata delantera BD-789 ===
    { material: "Balata delantera BD-789", type: "entry", quantity: 24, unit_cost: 1750, supplier: "Frenosa S.A.", invoice_number: "FR-2201", daysAgo: 90 },
    { material: "Balata delantera BD-789", type: "exit",  quantity: 6,  destination: "Unidad 05 / 17", reason: "Cambio correctivo", daysAgo: 40 },

    // === Diesel ULSD ===
    { material: "Diesel ULSD", type: "entry", quantity: 15000, unit_cost: 24.1, supplier: "PEMEX Estación 4421", invoice_number: "PX-20241101", daysAgo: 89 },
    { material: "Diesel ULSD", type: "exit",  quantity: 2000, destination: "Flota norte", reason: "Suministro semanal", daysAgo: 82 },
    { material: "Diesel ULSD", type: "exit",  quantity: 3000, destination: "Flota sur / centro", reason: "Suministro semanal", daysAgo: 60 },
    { material: "Diesel ULSD", type: "entry", quantity: 8000, unit_cost: 24.5, supplier: "PEMEX Estación 4421", invoice_number: "PX-20241228", daysAgo: 42 },
    { material: "Diesel ULSD", type: "exit",  quantity: 4000, destination: "Flota completa", reason: "Suministro semanal", daysAgo: 30 },
    { material: "Diesel ULSD", type: "exit",  quantity: 2000, destination: "Flota norte", reason: "Suministro semanal", daysAgo: 9 },

    // === Empaque multiple EM-101 (stock bajo — min 10, actual 5) ===
    { material: "Empaque multiple EM-101", type: "entry", quantity: 15, unit_cost: 275, supplier: "Refacciones Martínez", invoice_number: "RM-5480", daysAgo: 86 },
    { material: "Empaque multiple EM-101", type: "exit",  quantity: 5,  destination: "Taller interno", reason: "Reparación motor", daysAgo: 55 },
    { material: "Empaque multiple EM-101", type: "exit",  quantity: 5,  destination: "Taller interno", reason: "Reparación motor", daysAgo: 18 },
  ];

  for (const mov of movements) {
    const date = daysAgo(mov.daysAgo);
    await prisma.inventoryMovement.create({
      data: {
        company_id: demoCompany.id,
        material_id: matId[mov.material],
        type: mov.type,
        quantity: mov.quantity,
        unit_cost: mov.unit_cost,
        total_cost: mov.unit_cost != null ? mov.unit_cost * mov.quantity : undefined,
        supplier: mov.supplier,
        invoice_number: mov.invoice_number,
        destination: mov.destination,
        reason: mov.reason,
        notes: mov.notes,
        created_by: admin.id,
        movement_date: date,
        created_at: date,
      },
    });
  }

  console.log(`Created ${movements.length} demo movements`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
