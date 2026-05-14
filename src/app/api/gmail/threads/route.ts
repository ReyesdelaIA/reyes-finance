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

function parseNameEmail(header: string): { name: string; email: string; nameFromEmail: boolean } {
  const match = header.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    const raw = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    if (raw) return { name: raw, email, nameFromEmail: false };
    return { name: emailToName(email), email, nameFromEmail: true };
  }
  const email = header.trim();
  return { name: emailToName(email), email, nameFromEmail: true };
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function isFromMe(from: string): boolean {
  return from.toLowerCase().includes(MY_EMAIL.toLowerCase());
}

function extractBodyText(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: Array<{ mimeType?: string; body?: { data?: string } }> }>;
}): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    // nested multipart
    for (const sub of part.parts ?? []) {
      if (sub.mimeType === "text/plain" && sub.body?.data) {
        return Buffer.from(sub.body.data, "base64url").toString("utf-8");
      }
    }
  }
  return "";
}

function extractGreetingName(text: string): string | null {
  // Match: "Hola José Manuel," / "Estimado José," / "Dear John," etc.
  const pattern =
    /(?:^|\n)\s*(?:Hola|Estimado|Estimada|Buenos\s+d[ií]as|Buenas\s+tardes|Dear|Hi|Querido|Querida)[,\s]+([A-ZÁÉÍÓÚÜÑ][^\n,!.@]{1,40?})(?:[,!.]|\s*\n|\s*$)/im;
  const match = text.match(pattern);
  if (!match) return null;
  const name = match[1].trim();
  if (name.length < 2 || name.includes("@") || name.toLowerCase().startsWith("http")) return null;
  return name;
}

type GmailMessage = {
  id?: string;
  internalDate: string;
  payload: { headers: Array<{ name: string; value: string }> };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = session.provider_token;
  if (!token) {
    return NextResponse.json(
      { error: "No hay token de Google. Cierra sesión y vuelve a iniciar sesión para reconectar con Gmail." },
      { status: 401 }
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - DAYS_LOOKBACK);
  const sinceStr = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;

  const threadsRes = await fetch(
    `${GMAIL_API}/threads?q=${encodeURIComponent(`from:${MY_EMAIL} after:${sinceStr}`)}&maxResults=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!threadsRes.ok) {
    const text = await threadsRes.text();
    return NextResponse.json({ error: `Gmail API error al listar threads: ${text}` }, { status: 500 });
  }

  const threadsData = await threadsRes.json();
  const threads: Array<{ id: string }> = threadsData.threads ?? [];

  const fiveDaysAgo = Date.now() - DAYS_NO_REPLY * 24 * 60 * 60 * 1000;

  type PendingEntry = {
    threadId: string;
    clientName: string;
    clientEmail: string;
    subject: string;
    daysSinceLastReply: number;
    lastSentDate: string;
    _nameFromEmail?: boolean;
    _firstFelipeMsgId?: string;
  };

  const pending: PendingEntry[] = [];
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

        messages.sort((a, b) => Number(a.internalDate) - Number(b.internalDate));

        let lastFelipeIdx = -1;
        for (let j = messages.length - 1; j >= 0; j--) {
          const from = getHeader(messages[j].payload?.headers ?? [], "From");
          if (isFromMe(from)) { lastFelipeIdx = j; break; }
        }

        const allFroms = messages.map((m) => getHeader(m.payload?.headers ?? [], "From"));
        const subject0 = getHeader(messages[0].payload?.headers ?? [], "Subject");

        if (lastFelipeIdx === -1) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "no_felipe_message", froms: allFroms });
          return null;
        }

        const lastFelipeMs = Number(messages[lastFelipeIdx].internalDate);
        if (isNaN(lastFelipeMs) || lastFelipeMs > fiveDaysAgo) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "too_recent" });
          return null;
        }

        const messagesAfter = messages.slice(lastFelipeIdx + 1);
        const clientReplies = messagesAfter.filter((msg) => {
          const from = getHeader(msg.payload?.headers ?? [], "From").toLowerCase();
          if (isFromMe(from)) return false;
          if (
            from.includes("noreply") || from.includes("no-reply") ||
            from.includes("mailer-daemon") || from.includes("postmaster") ||
            from.includes("notifications@") || from.includes("notify@")
          ) return false;
          return true;
        });

        if (clientReplies.length > 0) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "has_client_reply" });
          return null;
        }

        const lastFelipeMsg = messages[lastFelipeIdx];
        const headers = lastFelipeMsg.payload?.headers ?? [];
        const to = getHeader(headers, "To");
        const toAddresses = to.split(",").map((s) => s.trim());
        let clientName = "";
        let clientEmail = "";
        let nameFromEmail = false;
        for (const addr of toAddresses) {
          const parsed = parseNameEmail(addr);
          if (!parsed.email.toLowerCase().includes(MY_EMAIL.toLowerCase())) {
            clientName = parsed.name;
            clientEmail = parsed.email;
            nameFromEmail = parsed.nameFromEmail;
            break;
          }
        }

        if (!clientEmail) {
          if (debug) debugLog.push({ threadId: thread.id, subject: subject0, reason: "no_client_email" });
          return null;
        }

        // Find the oldest Felipe message ID for greeting extraction
        let firstFelipeMsgId: string | undefined;
        if (nameFromEmail) {
          for (let j = 0; j <= lastFelipeIdx; j++) {
            const from = getHeader(messages[j].payload?.headers ?? [], "From");
            if (isFromMe(from) && messages[j].id) {
              firstFelipeMsgId = messages[j].id;
              break;
            }
          }
        }

        const subject = getHeader(headers, "Subject");
        const daysSinceLastReply = Math.floor((Date.now() - lastFelipeMs) / (1000 * 60 * 60 * 24));

        if (debug) debugLog.push({ threadId: thread.id, subject, reason: "INCLUDED", clientEmail, clientName, nameFromEmail, daysSinceLastReply });

        return { threadId: thread.id, clientName, clientEmail, subject, daysSinceLastReply, lastSentDate: new Date(lastFelipeMs).toISOString(), _nameFromEmail: nameFromEmail, _firstFelipeMsgId: firstFelipeMsgId };
      })
    );

    for (const r of results) {
      if (r) pending.push(r);
    }
  }

  // Resolve real names from email body greetings for email-derived names
  const needsNameResolution = pending.filter((p) => p._nameFromEmail && p._firstFelipeMsgId);
  if (needsNameResolution.length > 0) {
    await Promise.all(
      needsNameResolution.map(async (p) => {
        try {
          const msgRes = await fetch(
            `${GMAIL_API}/messages/${p._firstFelipeMsgId}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!msgRes.ok) return;
          const msg = await msgRes.json();
          const bodyText = extractBodyText(msg.payload ?? {});
          const greetingName = extractGreetingName(bodyText);
          if (greetingName) {
            p.clientName = greetingName;
            if (debug) debugLog.push({ msgId: p._firstFelipeMsgId, greetingFound: greetingName });
          }
        } catch { /* ignore, keep email-derived name */ }
      })
    );
  }

  pending.sort((a, b) => a.daysSinceLastReply - b.daysSinceLastReply);

  // Strip internal fields before returning
  const result = pending.map(({ _nameFromEmail: _a, _firstFelipeMsgId: _b, ...rest }) => rest);

  if (debug) {
    return NextResponse.json({ pending: result, totalThreads: threads.length, debug: debugLog });
  }

  return NextResponse.json({ pending: result });
}
