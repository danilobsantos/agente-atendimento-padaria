import { cookies } from "next/headers";
import { verifyJWT, type JWTPayload } from "@/lib/auth";

export async function getAuthUser(): Promise<JWTPayload | null> {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  return verifyJWT(token);
}