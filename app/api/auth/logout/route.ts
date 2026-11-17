// app/api/auth/logout/route.ts
import { NextRequest } from "next/server";
import { successResponse } from "@/utils/response";
import { buildAuthCookie, verifyToken } from "@/lib/auth";
import { bumpTokenVersion } from "@/lib/session";
import User from "@/models/User";
import { connectDB } from "@/lib/db";

/*
    Logout

    JWT is stored in an HttpOnly cookie.

    Semantics: normal logout invalidates ALL sessions for the user.
    The session version (tokenVersion) is incremented atomically,
    which revokes every JWT ever issued for this account — including
    tokens copied before logout. A single version counter cannot
    distinguish per-device sessions, so "logout" here means
    "logout everywhere". This is intentional.

    The cookie is ALWAYS cleared — even when the supplied token is
    invalid or expired — so the browser never keeps a stale credential.
*/
export async function POST(request?: NextRequest) {
  const token = request?.cookies?.get("token")?.value;

  if (token) {
    try {
      // Verify signature + expiry only (no session check — a revoked
      // or stale-version token must still be able to log out).
      const payload = await verifyToken(token);
      const userId =
        payload && typeof payload.userId === "string"
          ? payload.userId
          : null;

      if (userId) {
        await connectDB();
        // Only increment for a verified token belonging to an existing
        // user — never trust client-supplied identifiers.
        const user = await User.findById(userId).select("_id").lean();
        if (user) {
          await bumpTokenVersion(userId);

          // Drop this user's live Socket.IO connections so revoked
          // credentials cannot keep receiving realtime events.
          try {
            const { getIO } = await import("@/server/socket");
            getIO()
              ?.in(`user:${userId}`)
              .disconnectSockets(true);
          } catch {
            // Socket server may not be initialized (e.g. port conflict)
            // — revocation still applies to all future connections.
          }
        }
      }
    } catch {
      // Invalid/expired token — still clear the cookie below.
    }
  }

  const response = successResponse(null, "logged out");
  response.headers.append("Set-Cookie", buildAuthCookie("", 0));
  return response;
}
