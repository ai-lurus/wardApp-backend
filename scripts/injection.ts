
import { PrismaClient, AppModule } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING DB INJECTION ---');
  
  // 1. Get cesrvarg8@gmail.com and give fleet access
  let user1 = await prisma.user.findUnique({
    where: { email: 'cesrvarg8@gmail.com' },
    include: { company: true }
  });

  if (user1) {
    console.log(`Found user: ${user1.email} in company: ${user1.company.name}`);
    
    // Ensure 'flotas' is in company active_modules
    if (!user1.company.active_modules.includes(AppModule.flotas)) {
      await prisma.company.update({
        where: { id: user1.company_id },
        data: {
          active_modules: {
            set: [...user1.company.active_modules, AppModule.flotas]
          }
        }
      });
      console.log(`Added 'flotas' module to company: ${user1.company.name}`);
    } else {
      console.log(`Company ${user1.company.name} already has 'flotas' module.`);
    }
  } else {
    console.log(`User cesrvarg8@gmail.com not found. Creating him in a default company...`);
    // Find or create a default company
    let defaultCompany = await prisma.company.findFirst({ where: { slug: 'ward-dev' } });
    if (!defaultCompany) {
      defaultCompany = await prisma.company.create({
        data: {
          name: 'Ward Dev Company',
          slug: 'ward-dev',
          active_modules: [AppModule.inventario, AppModule.flotas]
        }
      });
    }
    const hash = await bcrypt.hash('demo123', 10);
    user1 = await prisma.user.create({
      data: {
        email: 'cesrvarg8@gmail.com',
        name: 'Cesar Vargas',
        password_hash: hash,
        role: 'admin',
        company_id: defaultCompany.id
      },
      include: { company: true }
    });
    console.log(`Created user cesrvarg8@gmail.com in company ${defaultCompany.name}`);
  }

  // 2. Create or find another company
  let otherCompany = await prisma.company.findFirst({
    where: {
      NOT: {
        id: user1.company_id
      }
    }
  });

  if (!otherCompany) {
    console.log('No other company found, creating a new one...');
    otherCompany = await prisma.company.create({
      data: {
        name: 'Logística Global S.A.',
        slug: 'logistica-global',
        active: true,
        active_modules: [AppModule.inventario, AppModule.flotas],
        subscription_status: 'active'
      }
    });
    console.log(`Created new company: ${otherCompany.name}`);
  } else {
    console.log(`Found existing other company: ${otherCompany.name}`);
    // Ensure 'flotas' is active
    if (!otherCompany.active_modules.includes(AppModule.flotas)) {
      await prisma.company.update({
        where: { id: otherCompany.id },
        data: {
          active_modules: {
            set: [...otherCompany.active_modules, AppModule.flotas]
          }
        }
      });
      console.log(`Ensured 'flotas' module active for ${otherCompany.name}`);
    }
  }

  // 3. Create a new user for the other company
  const newUserEmail = 'contacto@logistica.com';
  const existingNewUser = await prisma.user.findUnique({ where: { email: newUserEmail } });

  if (!existingNewUser) {
    const hash = await bcrypt.hash('demo123', 10);
    const newUser = await prisma.user.create({
      data: {
        email: newUserEmail,
        name: 'Gerente Logística',
        password_hash: hash,
        role: 'admin',
        active: true,
        company_id: otherCompany.id
      }
    });
    console.log(`Created new user: ${newUser.email} for company ${otherCompany.name}`);
  } else {
    console.log(`User ${newUserEmail} already exists.`);
  }

  console.log('--- DB INJECTION COMPLETED ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
