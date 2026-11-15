import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  await connectDB();

  return Response.json({
    message: "Database connected successfully",
  });
}
