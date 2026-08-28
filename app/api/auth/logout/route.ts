// app/api/auth/logout/route.ts
import { successResponse } from "@/utils/response";
/*
    Logout

    JWT is stored in cookie.

    Logout removes cookie.
*/

export async function POST() {
  const response = successResponse(null, "logged out");

  response.headers.append("Set-Cookies", "token=; HttpOnly; Path=/; Max-Age=0");
  return response;
}
