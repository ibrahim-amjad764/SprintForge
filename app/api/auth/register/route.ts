import { successResponse, errorResponse } from "../../../../utils/response";
import { connectDB } from "../../../../lib/db";
import User from "../../../../models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, getClientIP } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/auth";
import { apiError } from '@/utils/error-handler';

/*
    Register API

    Flow:

    1. Receive user data
    2. Validate input
    3. Rate limit (per IP and per email)
    4. Check existing user
    5. Encrypt password
    6. Save user
*/

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

// Rate limits: 20 registrations / 15 min per IP,
// 5 registrations / 15 min per email (slows enumeration/spam).
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_IP_LIMIT = 20;
const REGISTER_EMAIL_LIMIT = 5;

export async function POST(request: Request) {
  try {
    // CSRF: reject cross-origin registration attempts
    if (!isSameOriginMutation(request)) {
      return errorResponse("Forbidden", 403);
    }

    const body = await request.json();

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse("Invalid input");
    }
    const { name, email, password } = validation.data;

    const ip = getClientIP(request);
    const normalizedEmail = email.toLowerCase().trim();

    const ipAllowed = rateLimit(`register:ip:${ip}`, REGISTER_IP_LIMIT, REGISTER_WINDOW_MS);
    const emailAllowed = rateLimit(
      `register:email:${normalizedEmail}`,
      REGISTER_EMAIL_LIMIT,
      REGISTER_WINDOW_MS,
    );

    if (!ipAllowed || !emailAllowed) {
      return errorResponse("Too many requests", 429);
    }

    await connectDB();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return errorResponse("Email already registered");
    }

    const hashPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: normalizedEmail, password: hashPassword });
    return successResponse(
      { id: user._id, name: user.name, email: user.email },
      "Account Created Successfully",
    );
  } catch (error) {
    return apiError(error, 'Server error');
  }
}
