import "server-only";
import nodemailer from "nodemailer";
import { config } from "../config";

/**
 * The whole outbound-mail surface (ADR-0011): one send over SMTP, and a
 * predicate. The provider is entirely a `.env` matter — nothing in here
 * knows whether Resend, SES, or a company mail server is behind the five
 * `MAIL_*` settings.
 *
 * Nothing in `src/app/` may import this module — same rule as the DB.
 */

/** ~10s. A hanging provider must not pin the route handler that awaits a send. */
const SEND_TIMEOUT_MS = 10_000;

export interface MailMessage {
  /** A single recipient address. */
  to: string;
  subject: string;
  /** Plain-text body. Always sent — some clients never render the HTML part. */
  text: string;
  html: string;
}

/**
 * `sendMail` was called with no mailer configured. A typed error, not a
 * silent no-op: the caller decides how to degrade (a `202` with a logged
 * warning, an operator-minted link), and it can only do that if the
 * failure is visible to it.
 */
export class MailNotConfiguredError extends Error {
  readonly code = "MAIL_NOT_CONFIGURED";
  constructor() {
    super("mail is not configured (MAIL_SMTP_* / MAIL_FROM unset)");
    this.name = "MailNotConfiguredError";
  }
}

/** A send did not complete within {@link SEND_TIMEOUT_MS}. Surfaces as a failure, never a hang. */
export class MailTimeoutError extends Error {
  readonly code = "MAIL_TIMEOUT";
  constructor(ms: number) {
    super(`mail send timed out after ${ms}ms`);
    this.name = "MailTimeoutError";
  }
}

interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** The five settings, or null when the app is running with mail disabled. */
function readMailConfig(): MailConfig | null {
  const { MAIL_SMTP_HOST, MAIL_SMTP_PORT, MAIL_SMTP_USER, MAIL_SMTP_PASS, MAIL_FROM } = config;
  // config.schema.ts guarantees these are all-set or all-unset, so this
  // check is really just narrowing the types.
  if (
    MAIL_SMTP_HOST === undefined ||
    MAIL_SMTP_PORT === undefined ||
    MAIL_SMTP_USER === undefined ||
    MAIL_SMTP_PASS === undefined ||
    MAIL_FROM === undefined
  ) {
    return null;
  }
  return {
    host: MAIL_SMTP_HOST,
    port: MAIL_SMTP_PORT,
    user: MAIL_SMTP_USER,
    pass: MAIL_SMTP_PASS,
    from: MAIL_FROM,
  };
}

/** Whether an outbound mailer is configured. Callers branch on this to degrade cleanly. */
export function isMailConfigured(): boolean {
  return readMailConfig() !== null;
}

/**
 * Everything below the `@`. Logs identify a failed send by domain only —
 * `security.md` § Privacy: logs record user ids, never emails, and this is
 * the first code that would be tempted to break that.
 */
function recipientDomain(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 || at === address.length - 1 ? "(no domain)" : address.slice(at + 1);
}

/** Only the fields that can't carry an address, a subject, a token, or a link. */
function safeErrorShape(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error };
  const e = error as Error & { code?: unknown; responseCode?: unknown; command?: unknown };
  return { name: e.name, code: e.code, responseCode: e.responseCode, command: e.command };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new MailTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Send one message. Throws {@link MailNotConfiguredError} when no mailer is
 * configured, {@link MailTimeoutError} on a hang, or the transport's own
 * error on a rejected send — it **never resolves having sent nothing**.
 * Failures log at error level with the recipient domain only.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const mailConfig = readMailConfig();
  if (!mailConfig) throw new MailNotConfiguredError();

  const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    // 465 is implicit TLS; 587/25 upgrade with STARTTLS.
    secure: mailConfig.port === 465,
    auth: { user: mailConfig.user, pass: mailConfig.pass },
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });

  try {
    await withTimeout(
      transporter.sendMail({
        from: mailConfig.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      SEND_TIMEOUT_MS,
    );
  } catch (error) {
    console.error("mail: send failed", {
      domain: recipientDomain(message.to),
      ...safeErrorShape(error),
    });
    throw error;
  } finally {
    transporter.close();
  }
}
