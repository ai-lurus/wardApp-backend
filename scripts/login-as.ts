// login-as.ts — dev helper that mints a short-lived JWT for a given user
// without going through bcrypt / the /auth/login endpoint. Useful for
// local multi-tenant debugging and for supertest fixtures.
//
// Usage:
//   tsx scripts/login-as.ts admin.alfa@demo.com
//   tsx scripts/login-as.ts --company alfa --role admin
//
// Prints a bearer token to stdout (and nothing else) so it can be
// piped into curl:
//   TOKEN=$(tsx scripts/login-as.ts admin.alfa@demo.com)
//   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/dashboard/stats
//
// DEV ONLY. Do not import from application code. Signs with the same
// JWT_SECRET + claim shape as src/services/auth.service.ts so the
// authMiddleware accepts the token verbatim.

import jwt, { SignOptions } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env";

// Hard refuse to run in production. This script mints a valid bearer
// token without going through bcrypt / /auth/login, so executing it
// against a prod database would be an authentication bypass. Keep the
// guard even though scripts/ is excluded from the Docker image —
// defense in depth.
if (process.env.NODE_ENV === "production") {
  process.stderr.write(
    "login-as.ts refuses to run when NODE_ENV=production. " +
      "This script is a dev-only auth bypass; use the real /auth/login endpoint instead.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

type Args = {
  email?: string;
  companySlug?: string;
  role?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--company") {
      args.companySlug = argv[++i];
    } else if (arg === "--role") {
      args.role = argv[++i];
    } else if (!arg.startsWith("--") && !args.email) {
      args.email = arg;
    }
  }
  return args;
}

async function resolveUser(args: Args) {
  if (args.email) {
    const user = await prisma.user.findUnique({ where: { email: args.email } });
    if (!user) throw new Error(`No user found with email ${args.email}`);
    return user;
  }

  if (args.companySlug) {
    const company = await prisma.company.findUnique({ where: { slug: args.companySlug } });
    if (!company) throw new Error(`No company found with slug ${args.companySlug}`);
    const user = await prisma.user.findFirst({
      where: { company_id: company.id, ...(args.role ? { role: args.role } : {}) },
      orderBy: { created_at: "asc" },
    });
    if (!user) {
      throw new Error(
        `No user found for company ${args.companySlug}${args.role ? ` with role ${args.role}` : ""}`
      );
    }
    return user;
  }

  throw new Error("Usage: login-as.ts <email> | login-as.ts --company <slug> [--role <role>]");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const user = await resolveUser(args);

  const token = jwt.sign(
    { userId: user.id, role: user.role, companyId: user.company_id },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as SignOptions
  );

  process.stdout.write(token);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
