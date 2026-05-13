import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MY_EMAIL = "felipe@reyesia.com";
const DAYS_LOOKBACK = 60;
const DAYS_NO_REPLY = 5;

function parseNameEmail(header: string): { name: string; email: string } {
  const match = header.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || match[2].trim(), email: match[2].trim() };
  }
  return { name: header.trim(), email: header.trim() };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = session.provider_token;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "No hay token de Google. Cierra sesión y vuelve a iniciar sesión para reconectar con Gmail.",
      },
      { status: 401 }
    );
  }

  // Date 60 days ago in YYYY/MM/DD format
  const since = new Date();
  since.setDate(since.getDate() - DAYS_LOOKBACK);
  const sinceStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;

  const threadsRes = await fetch(
    `${GMAIL_API}/threads?q=in:sent+after:${sinceStr}&maxResults=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!threadsRes.ok) {
    const text = await threadsRes.text();
    return NextResponse.json(
      { error: `Gmail API error al listar threads: ${text}` },
      { status: 500 }
    );
  }

  const threadsData = await threadsRes.json();
  const threads: Array<{ id: string }> = threadsData.threads ?? [];

  const fiveDaysAgo = Date.now() - DAYS_NO_REPLY * 24 * 60 * 60 * 1000;

  // Fetch threads in parallel batches of 10
  const pending: Array<{
    threadId: string;
    clientName: string;
    clientEmail: string;
    subject: string;
    daysSinceLastReply: number;
    lastSentDate: string;
  }> = [];

  const BATCH = 10;
  for (let i = 0; i < threads.length; i += BATCH) {
    const batch = threads.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (thread) => {
        const res = await fetch(
          `${GMAIL_API}/threads/${thread.id}?format=metadata&metadataHeaders=From,To,Subject,Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const messages: Array<{
          internalDate: string;
          payload: { headers: Array<{ name: string; value: string }> };
        }> = data.messages ?? [];
        if (messages.length === 0) return null;

        messages.sort(
          (a, b) => Number(a.internalDate) - Number(b.internalDate)
        );

        const lastMsg = messages[messages.length - 1];
        const headers = lastMsg.payload?.headers ?? [];

        const from = getHeader(headers, "From");
        const fromEmail = parseNameEmail(from).email.toLowerCase();

        // Last message must be from Felipe (no client reply yet)
        if (!fromEmail.includes(MY_EMAIL.toLowerCase())) return null;

        const dateMs = Number(lastMsg.internalDate);
        if (isNaN(dateMs) || dateMs > fiveDaysAgo) return null;

        const to = getHeader(headers, "To");
        const { name: clientName, email: clientEmail } = parseNameEmail(to);

        if (
          !clientEmail ||
          clientEmail.toLowerCase().includes(MY_EMAIL.toLowerCase())
        )
          return null;

        const subject = getHeader(headers, "Subject");
        const daysSinceLastReply = Math.floor(
          (Date.now() - dateMs) / (1000 * 60 * 60 * 24)
        );

        return {
          threadId: thread.id,
          clientName,
          clientEmail,
          subject,
          daysSinceLastReply,
          lastSentDate: new Date(dateMs).toISOString(),
        };
      })
    );

    for (const r of results) {
      if (r) pending.push(r);
    }
  }

  pending.sort((a, b) => b.daysSinceLastReply - a.daysSinceLastReply);

  return NextResponse.json({ pending });
}
