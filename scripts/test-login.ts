import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  const email = "pdemo@ialurus.com";
  const password = "demo123";
  
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    console.log("User not found");
    return;
  }
  
  const valid = await bcrypt.compare(password, user.password_hash);
  console.log("Password valid:", valid);
}

main().finally(() => prisma.$disconnect());
