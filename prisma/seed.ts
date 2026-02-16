import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
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
    },
  });

  console.log("Created admin user:", admin.email);

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
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categories[cat.name] = created.id;
  }

  console.log("Created categories:", Object.keys(categories).join(", "));

  // Create materials (skip if already seeded)
  const existingCount = await prisma.material.count();
  if (existingCount === 0) {
    const materials = [
      { name: "Llanta 295/80 R22.5", category: "Llantas", unit: "pieza", reference_price: 8500, min_stock: 10, current_stock: 24 },
      { name: "Llanta 11R 24.5", category: "Llantas", unit: "pieza", reference_price: 7200, min_stock: 8, current_stock: 12 },
      { name: "Filtro de aceite FP-123", category: "Filtros", unit: "pieza", reference_price: 350, min_stock: 20, current_stock: 45 },
      { name: "Filtro de aire FA-456", category: "Filtros", unit: "pieza", reference_price: 520, min_stock: 15, current_stock: 8 },
      { name: "Balata delantera BD-789", category: "Balatas", unit: "juego", reference_price: 1800, min_stock: 12, current_stock: 18 },
      { name: "Diesel ULSD", category: "Diesel", unit: "litro", reference_price: 24.5, min_stock: 5000, current_stock: 12000 },
      { name: "Empaque multiple EM-101", category: "Empaques", unit: "pieza", reference_price: 280, min_stock: 10, current_stock: 5 },
    ];

    for (const mat of materials) {
      await prisma.material.create({
        data: {
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
    console.log(`Materials already seeded (${existingCount} found), skipping`);
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
