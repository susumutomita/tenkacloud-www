// Pure, runtime-agnostic validation + email building for the contact endpoint.
// Kept separate from the Cloudflare-specific handler so it can be unit-tested in
// plain Node (no `cloudflare:email` / Workers runtime needed).

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

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
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
