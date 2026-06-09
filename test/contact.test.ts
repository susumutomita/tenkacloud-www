import { describe, expect, it } from "vitest";
import { buildEmail, buildRawMime, validateContact } from "../functions/_lib/validate";

describe("validateContact", () => {
  it("should reject bot submissions via the honeypot", () => {
    const result = validateContact({ name: "x", email: "x@y.com", botcheck: "i am a bot" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.spam).toBe(true);
  });

  it("should require both name and email", () => {
    expect(validateContact({ name: "", email: "" })).toMatchObject({
      ok: false,
      spam: false,
      status: 400,
    });
    expect(validateContact({ name: "Taro", email: "" })).toMatchObject({ ok: false, status: 400 });
  });

  it("should reject a malformed email", () => {
    expect(validateContact({ name: "Taro", email: "not-an-email" })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("should accept and trim a valid submission", () => {
    const result = validateContact({
      name: "  Taro  ",
      email: "taro@example.com",
      company: "Acme",
      message: "hello",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Taro");
      expect(result.value.email).toBe("taro@example.com");
      expect(result.value.company).toBe("Acme");
      expect(result.value.plan).toBe("");
    }
  });

  it("should truncate overlong fields to their limits", () => {
    const result = validateContact({ name: "a".repeat(200), email: "taro@example.com" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name.length).toBe(80);
  });

  it("should strip CR/LF and control chars (mail-header-injection guard)", () => {
    const result = validateContact({
      name: "Taro\r\nBcc: evil@example.com",
      email: "taro@example.com",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).not.toMatch(/[\r\n]/);
      expect(result.value.name).toContain("Taro");
    }
  });
});

describe("buildRawMime", () => {
  it("should encode the subject as a UTF-8 word and base64 the body", () => {
    const mime = buildRawMime({
      from: "contact@tenkacloud.com",
      to: "you@gmail.com",
      replyTo: "taro@example.com",
      subject: "お問い合わせ",
      text: "本文",
    });
    expect(mime).toContain("From: contact@tenkacloud.com");
    expect(mime).toContain("To: you@gmail.com");
    expect(mime).toContain("Reply-To: taro@example.com");
    expect(mime).toContain("Subject: =?UTF-8?B?");
    expect(mime).toContain("Content-Transfer-Encoding: base64");
    // header/body separated by a blank CRLF line
    expect(mime).toContain("\r\n\r\n");
  });
});

describe("buildEmail", () => {
  it("should include the inquirer's details, plan, and origin", () => {
    const { subject, text } = buildEmail(
      {
        name: "Taro",
        email: "taro@example.com",
        company: "Acme",
        plan: "Hosted Event",
        scale: "",
        message: "hi",
      },
      "https://tenkacloud.com",
    );
    expect(subject).toContain("Taro");
    expect(subject).toContain("Hosted Event");
    expect(text).toContain("taro@example.com");
    expect(text).toContain("Acme");
    expect(text).toContain("hi");
    expect(text).toContain("https://tenkacloud.com");
  });
});
