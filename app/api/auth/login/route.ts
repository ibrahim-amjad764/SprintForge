import { connectDB } from "../../../../lib/db";
import User from "../../../../models/User";
import bcrypt from "bcryptjs";
import { createToken, buildAuthCookie, isSameOriginMutation } from "../../../../lib/auth";
import { errorResponse, successResponse } from "../../../../utils/response";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { apiError } from '@/utils/error-handler';

// Rate limits: 30 attempts / 15 min per IP (volumetric),
// 10 attempts / 15 min per email (credential-stuffing protection).
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = 30;
const LOGIN_EMAIL_LIMIT = 10;
const SESSION_MAX_AGE = 604800; // 7 days

export async function POST(request: Request) {
  try {
    // CSRF: reject cross-origin login attempts
    if (!isSameOriginMutation(request)) {
      return errorResponse("Forbidden", 403);
    }

    const body = await request.json();
    const { email, password } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return errorResponse("Invalid credentials");
    }

    const ip = getClientIP(request);
    const normalizedEmail = email.toLowerCase().trim();

    const ipAllowed = rateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
    const emailAllowed = rateLimit(
      `login:email:${normalizedEmail}`,
      LOGIN_EMAIL_LIMIT,
      LOGIN_WINDOW_MS,
    );

    if (!ipAllowed || !emailAllowed) {
      return errorResponse("Too many requests", 429);
    }

    await connectDB();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return errorResponse("Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return errorResponse("Invalid credentials");
    }

    const token = await createToken(
      user._id.toString(),
      user.role,
      user.tokenVersion ?? 0,
    );
    const response = successResponse(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      "Login successful",
    );

    response.headers.append("Set-Cookie", buildAuthCookie(token, SESSION_MAX_AGE));
    return response;
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
