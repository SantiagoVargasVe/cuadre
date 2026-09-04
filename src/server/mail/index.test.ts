import { afterEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, sendMailMock, closeMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const closeMock = vi.fn();
  return {
    sendMailMock,
    closeMock,
    createTransportMock: vi.fn(() => ({ sendMail: sendMailMock, close: closeMock })),
  };
});

// Nothing in this suite opens a socket — the SMTP client is entirely mocked
// (testing.md: no network in tests).
vi.mock("nodemailer", () => ({ default: { createTransport: createTransportMock } }));

/** A full, valid environment minus the mail keys — mirrors config.test.ts. */
const BASE_ENV: Record<string, string> = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://cuadre:change-me@localhost:5432/cuadre",
  AUTH_SECRET: "a".repeat(32),
  SUPPORTED_CURRENCIES: "COP,USD,EUR",
  DEFAULT_CURRENCY: "COP",
  FX_PROVIDER: "open-er-api",
  FX_BASE_CURRENCY: "USD",
  FX_TRM_CROSSCHECK: "true",
};

const MAIL_ENV: Record<string, string> = {
  MAIL_SMTP_HOST: "smtp.example.com",
  MAIL_SMTP_PORT: "587",
  MAIL_SMTP_USER: "smtp-user",
  MAIL_SMTP_PASS: "smtp-pass",
  MAIL_FROM: "no-reply@example.com",
};

function stubEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("mail transport", () => {
  it("reports configured only when all five settings are present", async () => {
    stubEnv({ ...BASE_ENV, ...MAIL_ENV });
    const { isMailConfigured } = await import("./index");
    expect(isMailConfigured()).toBe(true);
  });

  it("reports unconfigured when the mail keys are unset", async () => {
    stubEnv(BASE_ENV);
    const { isMailConfigured } = await import("./index");
    expect(isMailConfigured()).toBe(false);
  });

  it("sends through the transport with the configured envelope", async () => {
    stubEnv({ ...BASE_ENV, ...MAIL_ENV });
    sendMailMock.mockResolvedValue({ messageId: "abc" });
    const { sendMail } = await import("./index");

    await sendMail({
      to: "ana@example.com",
      subject: "Recuperar tu contraseña",
      text: "enlace",
      html: "<p>enlace</p>",
    });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: { user: "smtp-user", pass: "smtp-pass" },
        connectionTimeout: 10_000,
        socketTimeout: 10_000,
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "no-reply@example.com",
      to: "ana@example.com",
      subject: "Recuperar tu contraseña",
      text: "enlace",
      html: "<p>enlace</p>",
    });
    expect(closeMock).toHaveBeenCalled();
  });

  it("uses implicit TLS on port 465", async () => {
    stubEnv({ ...BASE_ENV, ...MAIL_ENV, MAIL_SMTP_PORT: "465" });
    sendMailMock.mockResolvedValue({});
    const { sendMail } = await import("./index");

    await sendMail({ to: "a@b.com", subject: "s", text: "t", html: "h" });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it("throws a typed error when unconfigured and never touches the transport", async () => {
    stubEnv(BASE_ENV);
    const { sendMail, MailNotConfiguredError } = await import("./index");

    await expect(
      sendMail({ to: "a@b.com", subject: "s", text: "t", html: "h" }),
    ).rejects.toBeInstanceOf(MailNotConfiguredError);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("surfaces a hanging send as a timeout rather than blocking forever", async () => {
    stubEnv({ ...BASE_ENV, ...MAIL_ENV });
    sendMailMock.mockReturnValue(new Promise(() => {})); // never settles
    const { sendMail, MailTimeoutError } = await import("./index");
    vi.useFakeTimers();

    const pending = sendMail({ to: "a@b.com", subject: "s", text: "t", html: "h" });
    const assertion = expect(pending).rejects.toBeInstanceOf(MailTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("logs a failed send by recipient domain only, then rethrows", async () => {
    stubEnv({ ...BASE_ENV, ...MAIL_ENV });
    const failure = Object.assign(new Error("550 <ana@secret.example> mailbox unavailable"), {
      code: "EENVELOPE",
      command: "RCPT TO",
    });
    sendMailMock.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendMail } = await import("./index");

    await expect(
      sendMail({
        to: "ana@secret.example",
        subject: "Recuperar tu contraseña",
        text: "https://app/reset/tok_secret",
        html: "h",
      }),
    ).rejects.toBe(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [label, meta] = errorSpy.mock.calls[0]!;
    expect(label).toBe("mail: send failed");
    expect(meta).toMatchObject({ domain: "secret.example", code: "EENVELOPE" });

    const serialized = JSON.stringify(errorSpy.mock.calls[0]);
    expect(serialized).not.toContain("ana@secret.example");
    expect(serialized).not.toContain("Recuperar");
    expect(serialized).not.toContain("tok_secret");
    expect(serialized).not.toContain("550");
  });
});
