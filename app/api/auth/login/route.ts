import { connectDB } from "../../../../lib/db";
import User from "../../../../models/User";
import bcrypt from "bcryptjs";
import { createToken } from "../../../../lib/auth";
import { errorResponse, successResponse } from "../../../../utils/response";

export async function POST(request: Request) {
  try {
    await connectDB();

    const { email, password } = await request.json();
    const user = await User.findOne({ email });

    if (!user) {
      return errorResponse("Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return errorResponse("Invalid credentials");
    }

    const token = await createToken(user._id.toString());
    const reponse = successResponse(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      "Login successful",
    );

    reponse.headers.append(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=604800`,
    );
    return reponse;
  } catch (error) {
    return errorResponse("Server error", 500);
  }
}
