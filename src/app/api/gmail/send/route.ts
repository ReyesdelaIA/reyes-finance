import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = session.provider_token;
  if (!token) {
    return NextResponse.json(
      { error: "No hay token de Google. Vuelve a iniciar sesión." },
      { status: 401 }
    );
  }

  const { threadId, clientName, clientEmail, subject } = await request.json();

  function extractFirstName(name: string): string {
    if (!name) return "";
    if (name.includes("@")) {
      const local = name.split("@")[0];
      const part = local.split(/[._\-+]/)[0];
      return part.charAt(0).toUpperCase() + part.slice(1);
    }
    return name.split(" ")[0];
  }
  const firstName = extractFirstName(clientName) || "equipo";

  const bodyText = `Hola ${firstName}, ¿cómo estás?

Solo escribo por seguimiento a las propuestas. Cualquier duda que tengas feliz conversamos.

Saludos!
Felipe`;

  const replySubject = subject?.startsWith("Re:") ? subject : `Re: ${subject || "Seguimiento"}`;

  const rawMessage = [
    `To: ${clientEmail}`,
    `Subject: ${replySubject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    bodyText,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage, threadId }),
    }
  );

  if (!sendRes.ok) {
    const text = await sendRes.text();
    return NextResponse.json({ error: `Error al enviar: ${text}` }, { status: 500 });
  }

  const msg = await sendRes.json();
  return NextResponse.json({ success: true, messageId: msg.id });
}
