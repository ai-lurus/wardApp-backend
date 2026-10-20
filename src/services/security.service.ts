import { prisma } from "../lib/prisma";

export async function checkLockStatus(ip: string, email: string) {
  const attempt = await prisma.loginAttempt.findUnique({
    where: { ip_email: { ip, email } }
  });

  if (attempt && attempt.lock_until && attempt.lock_until > new Date()) {
    const remainingSeconds = Math.ceil((attempt.lock_until.getTime() - Date.now()) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

export async function recordFailedAttempt(ip: string, email: string) {
  let attempt = await prisma.loginAttempt.findUnique({
    where: { ip_email: { ip, email } }
  });

  if (!attempt) {
    attempt = await prisma.loginAttempt.create({
      data: { ip, email, attempts: 1 }
    });
  } else {
    attempt = await prisma.loginAttempt.update({
      where: { id: attempt.id },
      data: { attempts: { increment: 1 } }
    });
  }

  let lockUntil: Date | null = null;

  if (attempt.attempts === 3) {
    lockUntil = new Date(Date.now() + 30 * 1000); // 30s
  } else if (attempt.attempts === 6) {
    lockUntil = new Date(Date.now() + 5 * 60 * 1000); // 5m
    await prisma.securityLog.create({
      data: {
        event_type: "BRUTE_FORCE_LOCK",
        ip,
        email,
        details: `6 intentos fallidos, bloqueado por 5 minutos`
      }
    });
  } else if (attempt.attempts > 6) {
    const multiplier = Math.pow(2, attempt.attempts - 6);
    lockUntil = new Date(Date.now() + 5 * 60 * 1000 * multiplier);
    await prisma.securityLog.create({
      data: {
        event_type: "BRUTE_FORCE_LOCK_ESCALATED",
        ip,
        email,
        details: `${attempt.attempts} intentos fallidos, bloqueado progresivamente`
      }
    });
  }

  if (lockUntil) {
    await prisma.loginAttempt.update({
      where: { id: attempt.id },
      data: { lock_until: lockUntil }
    });
  }
}

export async function resetAttempts(ip: string, email: string) {
  await prisma.loginAttempt.deleteMany({
    where: { ip, email }
  });
}
