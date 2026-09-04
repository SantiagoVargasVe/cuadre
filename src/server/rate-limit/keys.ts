import { createHash } from "node:crypto";

/**
 * Bucket keys for the `rate_limits` table.
 *
 * The IP-keyed helpers hand back a namespaced plaintext key — the IP is
 * already disclosed by the existing limiter and the Privacy Policy. An
 * **address** is different: `rate_limits` is a durable table, so a
 * plaintext-email key would turn the limiter into a lasting record of who
 * was probed (security.md § Privacy). So a per-address bucket is keyed by
 * the SHA-256 of the *normalized* address, never the address itself.
 */

/** `<namespace>:<ip>` — the shape the existing login/register/invite limits already use. */
export function ipKey(namespace: string, ip: string): string {
  return `${namespace}:${ip}`;
}

/**
 * `<namespace>:<sha256(normalized address)>`. Normalized (trim +
 * lowercase) so `Ana@x.com ` and `ana@x.com` share one bucket, matching
 * the case-insensitive `citext` the accounts table stores.
 */
export function hashedAddressKey(namespace: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `${namespace}:${digest}`;
}
