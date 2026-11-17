import type { NextRequest } from "next/server";
import User from "@/models/User";
import { requireSession } from "@/lib/session";
import type { AuthResult } from "@/lib/auth";
import { errorResponse } from "@/utils/response";
import logger from '@/lib/logger';

// ==========================================
// ADMIN VERIFICATION UTILITY
// ==========================================

/**
 * Verifies if a user has the ADMIN role directly from the database.
 * 
 * ⚠️ CRITICAL WARNING ⚠️
 * DO NOT import or use this function inside `middleware.ts`.
 * Middleware runs on the Edge Runtime and will crash if it touches Mongoose.
 * 
 * ✅ WHERE TO USE THIS:
 * - Inside App Router Server Components (if they need DB-level confirmation)
 * - Inside API Route Handlers (e.g., app/api/admin/users/route.ts)
 * - Inside Server Actions
 */
export async function checkAdmin(userId: string): Promise<boolean> {
  try {
    // .select("role") fetches ONLY the role field from MongoDB (Performance optimization)
    // .lean() returns a plain JS object instead of a heavy Mongoose Document (Memory optimization)
    const user = await User.findById(userId).select("role").lean();

    if (!user) {
      return false;
    }

    return user.role === "ADMIN";
  } catch (error) {
    // Fail securely: If the DB is down, deny access rather than allowing it
    logger.error({ err: error }, `[DB Admin Check] Database error verifying user ${userId}:`);
    return false; 
  }
}

/**
 * Require an authenticated ADMIN user for an API route.
 *
 * The role is verified against the database on every request —
 * the JWT role claim is never trusted for authorization.
 *
 * Usage:
 *     const auth = await requireAdmin(request);
 *     if (auth.response) return auth.response;
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireSession(request);

  if (auth.response) {
    return auth;
  }

  const isAdmin = await checkAdmin(auth.user.userId);

  if (!isAdmin) {
    return {
      user: null,
      response: errorResponse("Forbidden", 403),
    };
  }

  return auth;
}