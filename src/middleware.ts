import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-fallback-super-secret-key-32-chars-long"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // 1. Detect Subdomain
  let subdomain: string | null = null;
  const parts = hostname.split(".");
  if (hostname.endsWith(".localhost") && parts.length === 2) {
    subdomain = parts[0];
  } else if (parts.length > 2) {
    const candidate = parts[0].toLowerCase();
    if (!["www", "app", "api"].includes(candidate)) {
      subdomain = candidate;
    }
  }

  // Clone headers so we can set x-tenant-slug
  const requestHeaders = new Headers(request.headers);
  if (subdomain) {
    requestHeaders.set("x-tenant-slug", subdomain);
  }

  // 2. Protect Admin Routes
  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      const role = (payload as any).role || "USER";

      // Restrict access to /admin/configuracoes and /admin/usuarios for non-admin users
      if (
        (pathname.startsWith("/admin/configuracoes") ||
          pathname.startsWith("/admin/usuarios")) &&
        role !== "ADMIN"
      ) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);

      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("auth_token");
      return response;
    }
  }

  // 3. Subdomain root rewrite: if visiting tenant subdomain on "/", rewrite to /cardapio
  if (subdomain && pathname === "/") {
    const cardapioUrl = new URL("/cardapio", request.url);
    cardapioUrl.searchParams.set("tenant", subdomain);
    return NextResponse.rewrite(cardapioUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - uploads (uploaded files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|uploads|favicon.ico).*)",
  ],
};

