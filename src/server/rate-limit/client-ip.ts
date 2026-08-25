import "server-only";

/**
 * The client's IP, for rate-limit bucketing.
 *
 * `CF-Connecting-IP` is set by Cloudflare and strips any client-supplied
 * value, so it's trustworthy **as long as the app is only reachable
 * through the tunnel** — which it is: the production stack publishes no
 * ports and there is no router port-forward. If that ever changes, this
 * header becomes attacker-controlled and every IP-keyed limit becomes
 * bypassable (see docs/context/security.md § Known accepted risks).
 *
 * `X-Forwarded-For` is deliberately NOT consulted — it's client-settable.
 * Requests with no recognised header share one bucket, the conservative
 * direction: over-limiting an unusual case beats an unlimited one.
 */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}
