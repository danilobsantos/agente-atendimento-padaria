import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-fallback-super-secret-key-32-chars-long"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect routes inside /admin
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // Verify token in Middleware (jose is fully Edge/Middleware safe)
      await jwtVerify(token, SECRET_KEY);
      return NextResponse.next();
    } catch {
      // If validation fails, clear token and redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("auth_token");
      return response;
    }
  }

  return NextResponse.next();
}

// Configure which paths middleware runs on
export const config = {
  matcher: ["/admin/:path*"],
};
