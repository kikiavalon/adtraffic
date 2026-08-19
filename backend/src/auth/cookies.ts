import type { Request, Response } from 'express';

/**
 * Session cookie carrying the JWT. httpOnly so it is never readable from
 * JavaScript (mitigating token theft via XSS), and SameSite=Lax so it is not
 * sent on cross-site sub-requests (CSRF protection). The webapp and API are
 * served same-origin in both development (Vite proxies /api to the backend) and
 * production (nginx serves the webapp and proxies /api), so Lax works end to end.
 */
export const AUTH_COOKIE_NAME = 'adtraffic_token';

/** Matches the JWT lifetime issued in auth-service (7 days). */
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Secure in production (HTTPS); relaxed for local http development.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Set the session cookie on a successful login or registration. */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
}

/** Clear the session cookie on logout. Attributes must match those used to set it. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, baseCookieOptions());
}

/** Read the JWT from the session cookie, if present. No cookie-parser dependency. */
export function readAuthCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === AUTH_COOKIE_NAME) {
      const raw = part.slice(eq + 1).trim();
      // A malformed percent-encoding must not throw (it would surface as a 500
      // instead of a clean 401); fall back to the raw value, which jwt.verify rejects.
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}
