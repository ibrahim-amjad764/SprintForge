import { successResponse, errorResponse } from "../../../../utils/response";
import { connectDB } from "../../../../lib/db";
import User from "../../../../models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";

/*
    Register API

    Flow:

    1. Receive user data
    2. Validate input
    3. Check existing user
    4. Encrypt password
    5. Save user
*/

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse("Invalid input");
    }
    const { name, email, password } = validation.data;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return errorResponse("Email already registered");
    }

    const hashPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashPassword });
    return successResponse(
      { id: user._id, name: user.name, email: user.email },
      "Account Created Successfully",
    );
  } catch (error) {
    console.log(error);
    return errorResponse("Server error", 500);
  }
}
