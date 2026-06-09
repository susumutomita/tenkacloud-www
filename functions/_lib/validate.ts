// Pure, runtime-agnostic validation + email building for the contact endpoint.
// Kept free of `cloudflare:email` so it unit-tests in plain Node. Uses only
// Web-standard APIs (TextEncoder / btoa) that exist in both Node and Workers.

export interface ValidContact {
  name: string;
  email: string;
  company: string;
  plan: string;
  scale: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: ValidContact }
  | { ok: false; spam: true }
  | { ok: false; spam: false; status: number; message: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LIMITS = {
  name: 80,
  email: 120,
  company: 120,
  plan: 60,
  scale: 200,
  message: 2000,
} as const;

// Replace ASCII control chars (incl. CR/LF) with a space so values that later
// flow into email headers (Subject / Reply-To) cannot inject extra headers.
// Done per-character to avoid putting control chars in a regex.
function sanitize(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out.trim();
}

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? sanitize(v) : "";
}

export function validateContact(raw: Record<string, unknown>): ValidationResult {
  // Honeypot: a real user never fills `botcheck`. Treat any value as spam.
  if (field(raw, "botcheck")) return { ok: false, spam: true };

  const name = field(raw, "name");
  const email = field(raw, "email");
  if (!name || !email) {
    return { ok: false, spam: false, status: 400, message: "お名前とメールアドレスは必須です。" };
  }
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      spam: false,
      status: 400,
      message: "メールアドレスの形式が正しくありません。",
    };
  }

  return {
    ok: true,
    value: {
      name: name.slice(0, LIMITS.name),
      email,
      company: field(raw, "company").slice(0, LIMITS.company),
      plan: field(raw, "plan").slice(0, LIMITS.plan),
      scale: field(raw, "scale").slice(0, LIMITS.scale),
      message: field(raw, "message").slice(0, LIMITS.message),
    },
  };
}

export function buildEmail(value: ValidContact, origin: string): { subject: string; text: string } {
  const subject = `[TenkaCloud] お問い合わせ — ${value.name}${value.plan ? ` (${value.plan})` : ""}`;
  const text = [
    "TenkaCloud LP お問い合わせ",
    "",
    `お名前: ${value.name}`,
    `所属組織: ${value.company || "(未記入)"}`,
    `メールアドレス: ${value.email}`,
    `興味のあるプラン: ${value.plan || "(未指定)"}`,
    `想定規模 / 開催時期: ${value.scale || "(未記入)"}`,
    "",
    "メッセージ:",
    value.message || "(なし)",
    "",
    "---",
    `送信元: ${origin}`,
  ].join("\n");
  return { subject, text };
}

function base64Utf8(s: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(s)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Build a minimal RFC 5322 message (UTF-8 subject as an encoded-word, base64
 * body) for the Email Workers `send_email` binding. No mimetext / Node deps.
 * Header values are sanitized upstream, so they cannot inject extra headers.
 */
export function buildRawMime(args: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}): string {
  const foldedBody = (base64Utf8(args.text).match(/.{1,76}/g) ?? []).join("\r\n");
  return [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Reply-To: ${args.replyTo}`,
    `Subject: =?UTF-8?B?${base64Utf8(args.subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldedBody,
  ].join("\r\n");
}
