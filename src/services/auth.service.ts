import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { sendPasswordResetEmail } from "./email.service";

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: true }
  });

  if (!user || !user.active) {
    throw new AppError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new AppError(401, "Invalid credentials");
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, companyId: user.company_id },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.company_id,
      company: {
        id: user.company.id,
        name: user.company.name,
        active_modules: user.company.active_modules,
        subscription_status: user.company.subscription_status,
      }
    },
  };
}

export async function changePassword(userId: string, companyId: string, currentPassword: string, newPassword: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const user = await tx.user.findFirst({ where: { id: userId, company_id: companyId } });
    if (!user || !user.active) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new AppError(401, "Contraseña actual incorrecta");

    const password_hash = await bcrypt.hash(newPassword, 10);
    await tx.user.update({ where: { id: userId }, data: { password_hash } });
  });
}

export async function forgotPassword(email: string, baseUrl: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid email enumeration
  if (!user || !user.active) return;

  // Invalidate any previous unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { user_id: user.id, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { user_id: user.id, token, expires_at },
  });

  const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

  sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((err) =>
    console.error("[email] Reset email failed:", err)
  );
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used || record.expires_at < new Date()) {
    throw new AppError(400, "El enlace es inválido o ha expirado");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);
}

export async function getMe(userId: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
    const user = await tx.user.findFirst({
      where: { id: userId, company_id: companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        company_id: true,
        created_at: true,
        company: {
          select: {
            id: true,
            name: true,
            active_modules: true,
            subscription_status: true,
          }
        }
      },
    });
    if (!user || !user.active) throw new AppError(404, "User not found");
    return user;
  });
}
