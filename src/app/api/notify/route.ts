import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = process.env.NOTIFY_EMAIL ?? "";

type NotifyPayload = {
  tipo: "prestamo" | "devolucion" | "no_vuelve";
  material: string;
  cantidad: number;
  responsable: string;
  motivo?: string;
  fecha_devolucion?: string;
  es_teen?: boolean;
  notas?: string;
};

const EMOJIS = {
  prestamo:   "📦",
  devolucion: "✅",
  no_vuelve:  "❌",
};

const LABELS = {
  prestamo:   "Nuevo préstamo",
  devolucion: "Devolución registrada",
  no_vuelve:  "Material no vuelve",
};

const COLORS = {
  prestamo:   "#F9A01B",
  devolucion: "#16A34A",
  no_vuelve:  "#DC3545",
};

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY || !TO_EMAIL) {
    return NextResponse.json({ ok: false, error: "Missing config" }, { status: 500 });
  }

  const body: NotifyPayload = await request.json();
  const { tipo, material, cantidad, responsable, motivo, fecha_devolucion, es_teen, notas } = body;

  const emoji = EMOJIS[tipo];
  const label = LABELS[tipo];
  const color = COLORS[tipo];

  const subject = `${emoji} ${label}: ${material}`;

  const details = [
    `<tr><td style="color:#71717A;padding:4px 0">Material</td><td style="font-weight:600;padding:4px 0 4px 16px">${material}</td></tr>`,
    `<tr><td style="color:#71717A;padding:4px 0">Cantidad</td><td style="font-weight:600;padding:4px 0 4px 16px">${cantidad} unidad(es)</td></tr>`,
    `<tr><td style="color:#71717A;padding:4px 0">Responsable</td><td style="font-weight:600;padding:4px 0 4px 16px">${responsable}${es_teen ? " <span style='color:#0072BC;font-size:11px'>[Teen]</span>" : ""}</td></tr>`,
    motivo ? `<tr><td style="color:#71717A;padding:4px 0">Motivo</td><td style="font-weight:600;padding:4px 0 4px 16px">${motivo}</td></tr>` : "",
    fecha_devolucion ? `<tr><td style="color:#71717A;padding:4px 0">Devuelve</td><td style="font-weight:600;padding:4px 0 4px 16px">${fecha_devolucion}</td></tr>` : "",
    notas ? `<tr><td style="color:#71717A;padding:4px 0">Notas</td><td style="font-style:italic;padding:4px 0 4px 16px">"${notas}"</td></tr>` : "",
  ].filter(Boolean).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#F5F8FB;padding:24px;border-radius:12px">
      <div style="background:${color};border-radius:8px 8px 0 0;padding:16px 20px">
        <p style="margin:0;font-size:20px;font-weight:700;color:white">${emoji} ${label}</p>
      </div>
      <div style="background:white;border-radius:0 0 8px 8px;padding:20px;border:1px solid #D7E7F6;border-top:none">
        <table style="width:100%;border-collapse:collapse">
          ${details}
        </table>
      </div>
      <p style="text-align:center;color:#71717A;font-size:12px;margin-top:16px">
        BBYO Depósito · <a href="https://bbyoarg-deposito.vercel.app" style="color:#0072BC">bbyoarg-deposito.vercel.app</a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "BBYO Depósito <onboarding@resend.dev>",
      to: TO_EMAIL,
      subject,
      html,
    });
  } catch (err) {
    console.error("Error enviando email:", err);
    return NextResponse.json({ ok: false, error: "Email failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
