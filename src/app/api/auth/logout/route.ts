import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Clear HTTP-Only authentication cookie by setting Max-Age=0
  response.headers.set(
    "Set-Cookie",
    `auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
  return response;
}
