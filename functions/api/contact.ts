// Cloudflare Pages Function: POST /api/contact
//
// Validates a contact submission and emails it to the configured Gmail via the
// Email Workers `send_email` binding (Cloudflare-native, no third-party service;
// the data stays within Cloudflare). Same-origin with the LP, so no CORS.
//
// Bindings / vars (set by Terraform on the Pages project; see ../README.md):
//   - CONTACT_MAILER : send_email binding
//   - CONTACT_FROM   : verified sender on the zone (e.g. contact@tenkacloud.com)
//   - CONTACT_TO     : Email Routing destination (your Gmail), must be verified

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { buildEmail, validateContact } from "../_lib/validate";

interface Env {
  CONTACT_MAILER: { send(message: EmailMessage): Promise<void> };
  CONTACT_FROM: string;
  CONTACT_TO: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let raw: Record<string, unknown>;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      raw = Object.fromEntries(form as unknown as Iterable<[string, FormDataEntryValue]>) as Record<
        string,
        unknown
      >;
    }
  } catch {
    return json({ success: false, message: "リクエストの形式が不正です。" }, 400);
  }

  const result = validateContact(raw);
  if (!result.ok) {
    // Honeypot hit: pretend success so bots don't learn they were filtered.
    if (result.spam) return json({ success: true });
    return json({ success: false, message: result.message }, result.status);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const { subject, text } = buildEmail(result.value, origin);

  const mime = createMimeMessage();
  mime.setSender({ name: "TenkaCloud LP", addr: env.CONTACT_FROM });
  mime.setRecipient(env.CONTACT_TO);
  mime.setSubject(subject);
  mime.setHeader("Reply-To", result.value.email);
  mime.addMessage({ contentType: "text/plain", data: text });

  try {
    await env.CONTACT_MAILER.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, mime.asRaw()));
  } catch {
    return json({ success: false, message: "送信処理に失敗しました。" }, 502);
  }

  return json({ success: true });
};
