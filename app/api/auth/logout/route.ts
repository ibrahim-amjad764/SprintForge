// app/api/auth/logout/route.ts
import { successResponse } from "@/utils/response";
import { buildAuthCookie } from "@/lib/auth";
/*
    Logout

    JWT is stored in cookie.

    Logout removes cookie.
*/

export async function POST() {
  const response = successResponse(null, "logged out");

  response.headers.append("Set-Cookie", buildAuthCookie("", 0));
  return response;
}
