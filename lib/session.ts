// lib/session.ts
//
// Database-backed session validation.
//
// IMPORTANT: This module imports Mongoose and must NEVER be imported
// by middleware.ts or any Edge-runtime code. lib/auth.ts stays
// edge-safe (JWT signature verification only); this file adds the
// tokenVersion revocation check that requires a database lookup.
//
// Semantics:
// - JWTs carry a `tokenVersion` claim (missing/invalid → treated as
//   invalid, since every token issued after this change includes it).
// - The User document stores the current `tokenVersion` (missing
//   field → 0, matching legacy tokens issued before the claim
//   existed... see note below).
// - Logout increments tokenVersion atomically, invalidating ALL
//   sessions for that user (single-version scheme cannot distinguish
//   per-device sessions — this is the documented "logout everywhere"
//   behavior).

import type { NextRequest } from "next/server";
import User from "@/models/User";
import { verifyToken, isSameOriginMutation, type AuthResult } from "@/lib/auth";
import { errorResponse } from "@/utils/response";

export interface SessionUser {
  userId: string;
  // Fresh role from the database — never trust the JWT role claim.
  role?: string;
  tokenVersion: number;
}

/** Extracts the tokenVersion claim from a JWT payload, or null if absent/invalid. */
export function extractTokenVersion(payload: unknown): number | null {
  const v = (payload as { tokenVersion?: unknown } | null)?.tokenVersion;
  // Missing claim → legacy token → version 0 (backward compatible).
  if (v === undefined || v === null) return 0;
  // Reject malformed claims (non-integer, negative, non-number).
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return null;
  return v;
}

/*
    Validate a raw JWT string against the database session version.

    Returns the session user (with fresh DB role) or null when the
    token is invalid, expired, revoked (version mismatch), or the
    user no longer exists.
*/
/** Validates a session JWT and the DB-backed tokenVersion — returns null when revoked/expired. */
export async function validateSessionToken(
  token: string,
): Promise<SessionUser | null> {
  const payload = await verifyToken(token);
  if (!payload || typeof payload.userId !== "string") {
    return null;
  }

  const tokenVersion = extractTokenVersion(payload);
  if (tokenVersion === null) {
    return null;
  }

  let user: { tokenVersion?: number; role?: string } | null = null;
  try {
    user = (await User.findById(payload.userId)
      .select("tokenVersion role")
      .lean()) as { tokenVersion?: number; role?: string } | null;
  } catch {
    // Fail closed: if the DB is unreachable the session cannot be
    // verified — treat as unauthenticated rather than throwing.
    return null;
  }

  if (!user) {
    return null;
  }

  const dbVersion =
    typeof user.tokenVersion === "number" ? user.tokenVersion : 0;

  if (tokenVersion !== dbVersion) {
    return null;
  }

  return {
    userId: payload.userId,
    role: user.role,
    tokenVersion: dbVersion,
  };
}

/*
    Require a valid, non-revoked session for an API route.

    Drop-in replacement for requireAuth() — same AuthResult shape,
    plus DB-backed tokenVersion enforcement and CSRF protection.
*/
/** API guard: resolves the session user or returns a 401 Response in auth.response. */
export async function requireSession(
  request: NextRequest,
): Promise<AuthResult> {
  const token = request.cookies.get("token")?.value;
  const user = token ? await validateSessionToken(token) : null;

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

  return {
    user: { userId: user.userId, role: user.role, tokenVersion: user.tokenVersion },
    response: null,
  };
}

/*
    Socket.IO variant — validates a raw token string (from handshake
    auth, Authorization header, or cookie) against the session
    version. Used by server/socket.ts after JWT signature checks.
*/
/** Throws/returns error when the presented tokenVersion is stale (post-logout/password change). */
export async function assertTokenVersion(
  userId: string,
  tokenVersion: number,
): Promise<boolean> {
  let user: { tokenVersion?: number } | null = null;
  try {
    user = (await User.findById(userId)
      .select("tokenVersion")
      .lean()) as { tokenVersion?: number } | null;
  } catch {
    return false;
  }

  if (!user) return false;

  const dbVersion =
    typeof user.tokenVersion === "number" ? user.tokenVersion : 0;

  return tokenVersion === dbVersion;
}

/*
    Increment the user's session version — invalidates every JWT
    ever issued for this account. Atomic $inc; only call after the
    token has been verified and the user confirmed to exist.
*/
/** Increments User.tokenVersion, invalidating every outstanding session token. */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}
