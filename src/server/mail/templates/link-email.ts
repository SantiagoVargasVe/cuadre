import "server-only";
import type { MailMessage } from "../index";

/** Minimal HTML-escape for interpolating a URL into the HTML part. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface LinkEmailCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  linkFallback: string;
  expiry: string;
  ignore: string;
}

/**
 * The one message shape this app sends: a heading, a line, one link, an
 * expiry, an "ignore this" line. Plain-text **and** HTML; the HTML has
 * inline styles only — no `<style>`, no remote asset, no image, no
 * tracking pixel (ADR-0011). Every recovery/verification mail is built
 * through here so they can't drift.
 */
export function renderLinkEmail(c: LinkEmailCopy, link: string): Omit<MailMessage, "to"> {
  const text = [c.heading, "", c.body, "", link, "", c.expiry, "", c.ignore].join("\n");

  const safeLink = escapeHtml(link);
  const html = [
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;color:#111">`,
    `<h1 style="font-size:18px;margin:0 0 12px">${c.heading}</h1>`,
    `<p style="margin:0 0 16px">${c.body}</p>`,
    `<p style="margin:0 0 16px"><a href="${safeLink}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px">${c.cta}</a></p>`,
    `<p style="margin:0 0 4px;color:#666;font-size:13px">${c.linkFallback}</p>`,
    `<p style="margin:0 0 16px;color:#666;font-size:13px;word-break:break-all">${safeLink}</p>`,
    `<p style="margin:0 0 4px;color:#666;font-size:13px">${c.expiry}</p>`,
    `<p style="margin:0;color:#666;font-size:13px">${c.ignore}</p>`,
    `</div>`,
  ].join("");

  return { subject: c.subject, text, html };
}
