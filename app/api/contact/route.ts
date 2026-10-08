import { Resend } from "resend";

// SPEC 03 — POST /api/contact
// 200 { ok: true }                  enviado, o honeypot rellenado (descartado en silencio)
// 400 { ok: false, error: string }  campo vacío o formato de correo inválido
// 500 { ok: false, error: string }  faltan env vars o falló Resend

type ContactRequest = {
  name?: string;
  email?: string;
  message?: string;
  website?: string; // honeypot: los humanos nunca lo llenan
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let body: ContactRequest;
  try {
    body = await request.json();
  } catch {
    return fail("Body inválido.", 400);
  }

  // Honeypot: relleno → responder 200 sin enviar y sin avisar al bot.
  if ((body.website ?? "").trim() !== "") {
    return Response.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!name || !email || !message) {
    return fail("Todos los campos son obligatorios.", 400);
  }
  if (!EMAIL_RE.test(email)) {
    return fail("Correo electrónico inválido.", 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.error("[contact] faltan RESEND_API_KEY / CONTACT_TO_EMAIL / FROM_EMAIL en el entorno");
    return fail("Servicio de correo no configurado.", 500);
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Arcade Vault — Mensaje de ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  });

  if (error) {
    console.error(`[contact] Resend [${error.name}]: ${error.message}`);
    return fail("No se pudo enviar el mensaje.", 500);
  }

  return Response.json({ ok: true });
}
