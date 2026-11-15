import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { errorResponse } from "@/utils/response";

/*
    Authentication Helper

    This file handles:
    - Creating JWT tokens
    - Verifying JWT tokens
    - Extracting the authenticated user from API requests

*/
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env.local");
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

// Create JWT token
export async function createToken(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
  return token;
}

// Verify JWT token
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}

export interface AuthPayload {
  userId: string;
  role?: string;
}

export type AuthResult =
  | { user: AuthPayload; response: null }
  | { user: null; response: Response };

/*
    Extract the authenticated user from the session cookie.

    Returns null when the token is missing or invalid.
    The JWT is the only source of identity — client-supplied
    headers or body fields are never trusted.
*/
export async function getAuthUser(
  request: NextRequest,
): Promise<AuthPayload | null> {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload || typeof payload.userId !== "string") {
    return null;
  }

  return {
    userId: payload.userId,
    role: typeof payload.role === "string" ? payload.role : undefined,
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/*
    CSRF defense-in-depth for cookie-authenticated requests.

    SameSite=Lax already blocks cross-site POSTs in modern browsers,
    but this adds an explicit Origin/Referer check for mutation
    requests as a second layer.

    Policy:
    - Safe methods (GET/HEAD/OPTIONS) are never checked.
    - If neither Origin nor Referer is present the request is treated
      as a non-browser client (curl, server-to-server, tests) and
      allowed — browsers always send Origin on cross-site POSTs.
    - When a candidate origin exists it must match the request origin.
    - If the request origin cannot be determined (e.g. unit tests
      with minimal request mocks) the check is skipped.
*/
export function isSameOriginMutation(request: Request): boolean {
  const method = request.method?.toUpperCase();
  if (!method || SAFE_METHODS.has(method)) {
    return true;
  }

  let expectedOrigin: string | null = null;
  try {
    // NextRequest exposes nextUrl; plain Request does not
    expectedOrigin = (request as NextRequest).nextUrl?.origin ?? null;
  } catch {
    expectedOrigin = null;
  }

  // Fallback for handlers typed as plain Request (no nextUrl):
  // reconstruct the origin from the Host + forwarding headers.
  if (!expectedOrigin) {
    const host = request.headers.get("host");
    if (host) {
      const proto =
        request.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
      expectedOrigin = `${proto}://${host}`;
    }
  }
  if (!expectedOrigin) {
    return true;
  }

  const origin = request.headers.get("origin");
  let candidate = origin;

  if (!candidate) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        candidate = new URL(referer).origin;
      } catch {
        candidate = null;
      }
    }
  }

  if (!candidate) {
    return true;
  }

  return candidate === expectedOrigin;
}

/*
    Require an authenticated user for an API route.

    Usage:
        const auth = await requireAuth(request);
        if (auth.response) return auth.response;
        const userId = auth.user.userId;
*/
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await getAuthUser(request);

  if (!user) {
    return {
      user: null,
      response: errorResponse("Not authenticated", 401),
    };
  }

  // CSRF: reject cross-origin mutation requests carrying the session cookie
  if (!isSameOriginMutation(request)) {
    return {
      user: null,
      response: errorResponse("Forbidden", 403),
    };
  }

  return { user, response: null };
}

/*
    Build the session cookie string.

    - HttpOnly: not readable from JavaScript (XSS mitigation).
    - SameSite=Lax: sent on same-site requests and top-level GET
      navigations; blocks cross-site POST CSRF.
    - Secure: only in production — kept off in development so
      http://localhost sessions continue to work.
    - Path=/ and Max-Age control scope and lifetime.
*/
export function buildAuthCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `token=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}
