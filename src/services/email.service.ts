import { Resend } from "resend";
import { env } from "../config/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function log(subject: string, to: string) {
  console.log(`[email] Would send "${subject}" → ${to} (RESEND_API_KEY not set)`);
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  companyName: string;
  password: string;
  loginUrl?: string;
}) {
  const { to, name, companyName, password, loginUrl = "https://app.wardapp.com.mx" } = params;
  const subject = `Bienvenido a Ward — ${companyName}`;

  if (!resend) {
    log(subject, to);
    return;
  }

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html: welcomeHtml({ name, companyName, email: to, password, loginUrl }),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { to, name, resetUrl } = params;
  const subject = "Recuperación de contraseña — Ward";

  if (!resend) {
    log(subject, to);
    return;
  }

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to,
    subject,
    html: passwordResetHtml({ name, resetUrl }),
  });
}

// ─── HTML Templates ───────────────────────────────────────

function welcomeHtml(p: {
  name: string;
  companyName: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1C2536;padding:28px 40px;">
            <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px;">Ward</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hola <strong>${p.name}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6B7280;">
              Tu cuenta para <strong>${p.companyName}</strong> en Ward ha sido creada. Aquí están tus credenciales de acceso:
            </p>
            <table cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:20px 24px;margin-bottom:28px;width:100%;">
              <tr>
                <td style="font-size:13px;color:#6B7280;padding-bottom:8px;">Email</td>
                <td style="font-size:14px;font-weight:600;color:#111827;text-align:right;">${p.email}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6B7280;padding-top:8px;">Contraseña temporal</td>
                <td style="font-size:14px;font-weight:600;color:#111827;text-align:right;font-family:monospace;">${p.password}</td>
              </tr>
            </table>
            <p style="margin:0 0 28px;font-size:14px;color:#6B7280;">
              Te recomendamos cambiar tu contraseña en cuanto inicies sesión desde <strong>Mi cuenta → Cambiar contraseña</strong>.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1C2536;border-radius:6px;">
                  <a href="${p.loginUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Iniciar sesión</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">Ward · Sistema de gestión de inventario</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function passwordResetHtml(p: { name: string; resetUrl: string }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1C2536;padding:28px 40px;">
            <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:.5px;">Ward</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hola <strong>${p.name}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;color:#6B7280;">
              Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para continuar. El enlace expira en <strong>1 hora</strong>.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#1C2536;border-radius:6px;">
                  <a href="${p.resetUrl}" style="display:inline-block;padding:12px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Restablecer contraseña</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#9CA3AF;">Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">Ward · Sistema de gestión de inventario</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
