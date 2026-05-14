import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MY_EMAIL = "felipe@reyesia.com";
const DAYS_LOOKBACK = 60;
const DAYS_NO_REPLY = 5;

function emailToName(email: string): string {
  const local = email.split("@")[0];
  return local
    .split(/[._\-+]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function parseNameEmail(header: string): { name: string; email: string } {
  const match = header.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    const raw = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    const name = raw || emailToName(email);
    return { name, email };
  }
  const email = header.trim();
  return { name: emailToName(email), email };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function isFromMe(from: string): boolean {
  return from.toLowerCase().includes(MY_EMAIL.toLowerCase());
}

type GmailMessage = {
  internalDate: string;
  payload: { headers: Array<{ name: string; value: string }> };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";
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

  // Date 60 days ago
  const since = new Date();
  since.setDate(since.getDate() - DAYS_LOOKBACK);
  const sinceStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;

  // Search threads that include sent messages from Felipe in the last 60 days
  const threadsRes = await fetch(
    `${GMAIL_API}/threads?q=${encodeURIComponent(`from:${MY_EMAIL} after:${sinceStr}`)}&maxResults=200`,
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

  const pending: Array<{
    threadId: string;
    clientName: string;
    clientEmail: string;
    subject: string;
    daysSinceLastReply: number;
    lastSentDate: string;
  }> = [];

  const debugLog: Array<Record<string, unknown>> = [];

  const BATCH = 10;
  for (let i = 0; i < threads.length; i += BATCH) {
    const batch = threads.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (thread) => {
        const res = await fetch(
          `${GMAIL_API}/threads/${thread.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const messages: GmailMessage[] = data.messages ?? [];
        if (messages.length === 0) return null;

        messages.sort(
          (a, b) => Number(a.internalDate) - Number(b.internalDate)
        );

        // Find the LAST message sent by Felipe
        let lastFelipeIdx = -1;
        for (let j = messages.length - 1; j >= 0; j--) {
          const from = getHeader(messages[j].payload?.headers ?? [], "From");
          if (isFromMe(from)) {
            lastFelipeIdx = j;
            break;
          }
        }

        const allFroms = messages.map((m) => getHeader(m.payload?.headers ?? [], "From"));
        const subject0 = getHeader(messages[0].payload?.headers ?? [], "Subject");

        if (lastFelipeIdx === -1) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "no_felipe_message", froms: allFroms });
          return null;
        }

        const lastFelipeMsg = messages[lastFelipeIdx];
        const lastFelipeMs = Number(lastFelipeMsg.internalDate);

        if (isNaN(lastFelipeMs) || lastFelipeMs > fiveDaysAgo) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "too_recent", lastFelipeDate: new Date(lastFelipeMs).toISOString(), froms: allFroms });
          return null;
        }

        const messagesAfter = messages.slice(lastFelipeIdx + 1);
        const clientReplies = messagesAfter.filter((msg) => {
          const from = getHeader(msg.payload?.headers ?? [], "From");
          const fromLower = from.toLowerCase();
          if (isFromMe(from)) return false;
          if (
            fromLower.includes("noreply") ||
            fromLower.includes("no-reply") ||
            fromLower.includes("mailer-daemon") ||
            fromLower.includes("postmaster") ||
            fromLower.includes("notifications@") ||
            fromLower.includes("notify@")
          ) return false;
          return true;
        });

        if (clientReplies.length > 0) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "has_client_reply", replies: clientReplies.map((m) => getHeader(m.payload?.headers ?? [], "From")) });
          return null;
        }

        const headers = lastFelipeMsg.payload?.headers ?? [];
        const to = getHeader(headers, "To");
        const toAddresses = to.split(",").map((s) => s.trim());
        let clientName = "";
        let clientEmail = "";
        for (const addr of toAddresses) {
          const parsed = parseNameEmail(addr);
          if (!parsed.email.toLowerCase().includes(MY_EMAIL.toLowerCase())) {
            clientName = parsed.name;
            clientEmail = parsed.email;
            break;
          }
        }

        if (!clientEmail) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "no_client_email", to, froms: allFroms });
          return null;
        }

        const subject = getHeader(headers, "Subject");
        const daysSinceLastReply = Math.floor(
          (Date.now() - lastFelipeMs) / (1000 * 60 * 60 * 24)
        );

        if (debug) debugLog.push({ threadId: thread.id, subject, reason: "INCLUDED", clientEmail, daysSinceLastReply });

        return {
          threadId: thread.id,
          clientName,
          clientEmail,
          subject,
          daysSinceLastReply,
          lastSentDate: new Date(lastFelipeMs).toISOString(),
        };
      })
    );

    for (const r of results) {
      if (r) pending.push(r);
    }
  }

  pending.sort((a, b) => a.daysSinceLastReply - b.daysSinceLastReply);

  if (debug) {
    return NextResponse.json({ pending, totalThreads: threads.length, debug: debugLog });
  }

  return NextResponse.json({ pending });
}
