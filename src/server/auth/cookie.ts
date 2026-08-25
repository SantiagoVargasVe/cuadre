import "server-only";

/**
 * Session cookie shape (ADR-0003). httpOnly means no JavaScript can read
 * it at all — the point, since this is the credential that matters most
 * in an app whose entire output is who owes whom.
 */
export const SESSION_COOKIE_NAME = "cuadre_session";

const TTL_SECONDS = 30 * 24 * 60 * 60;

interface CookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge?: number;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Lax alone blocks cross-site POST — the first of the three ADR-0003
    // requirements. The other two (Origin validation, GET never mutates)
    // live in origin.ts and at each route handler respectively.
    sameSite: "lax",
    // Secure only in production: browsers silently drop Secure cookies over
    // plain-HTTP localhost, which would make dev login fail with no error.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

/** Same attributes, zero lifetime — what actually clears the cookie on logout. */
export function clearedSessionCookieOptions(): CookieOptions {
  return { ...sessionCookieOptions(), maxAge: 0 };
}
