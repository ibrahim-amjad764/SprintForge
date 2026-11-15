import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/auth";

// - Defines the expected shape of the decoded JWT payload
interface TokenPayload {
  userId: string;
  role?: string;
}

// - Protected routes configuration
const PROTECTED_PATHS = ["/dashboard", "/workspace", "/tasks", "/profile", "/analytics", "/settings"];
const ADMIN_PATHS = ["/dashboard/admin"];

const LOGIN_URL = "/login";
const UNAUTHORIZED_URL = "/unauthorized";

// - Middleware runs on Edge Runtime
// - Handles JWT authentication and role-based access control
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // - Check if current route requires authentication
  const isProtectedRoute = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (!isProtectedRoute) {
    const response = NextResponse.next();

    // - Prevent private routes from being indexed
    response.headers.set("X-Robots-Tag", "noindex");

    return response;
  }

  // - Redirect users without token to login
  if (!token) {
    return handleRedirect(request, LOGIN_URL, "Missing token");
  }

  // - Verify JWT token and extract user information
  const user = (await verifyToken(token)) as TokenPayload | null;

  if (!user) {
    return handleRedirect(request, LOGIN_URL, "Invalid token");
  }

  // - Restrict admin routes to ADMIN users only
  const isAdminRoute = ADMIN_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isAdminRoute && user.role !== "ADMIN") {
    return handleRedirect(
      request,
      UNAUTHORIZED_URL,
      "Insufficient permissions"
    );
  }

  // - Pass authenticated user data to Server Components
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-user-id", user.userId);
  requestHeaders.set("x-user-role", user.role || "USER");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // - Prevent authenticated pages from search indexing
  response.headers.set("X-Robots-Tag", "noindex");

  return response;
}

// - Handles secure redirects with callback URL support
function handleRedirect(
  request: NextRequest,
  destination: string,
  reason: string
) {
  const url = request.nextUrl.clone();

  url.pathname = destination;

  url.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname
  );

  console.warn(
    `[Auth] ${reason} | Path: ${request.nextUrl.pathname}`
  );

  return NextResponse.redirect(url);
}

// - Runs middleware only on protected application routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/tasks/:path*",
    "/profile/:path*",
    "/analytics/:path*",
    "/settings/:path*",
  ],
};