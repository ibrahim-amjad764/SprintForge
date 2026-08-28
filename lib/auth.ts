import { SignJWT, jwtVerify } from "jose";

/*
    Authentication Helper

    This file handles:
    - Creating JWT tokens
    - Verifying JWT tokens

*/
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env.local");
}

const secretKey = new TextEncoder().encode(JWT_SECRET);

// Create JWT token
export async function createToken(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
  return token;
}

// Verify JWT token
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    return null;
  }
}
