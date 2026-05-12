import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/models") ||
    pathname.startsWith("/api-keys") ||
    pathname.startsWith("/playground") ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/topup") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/affiliate") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/huong-dan") ||
    pathname.startsWith("/changelog") ||
    pathname.startsWith("/admin");

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isProtected && !token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/models/:path*",
    "/api-keys/:path*",
    "/playground/:path*",
    "/usage/:path*",
    "/topup/:path*",
    "/transactions/:path*",
    "/settings/:path*",
    "/affiliate/:path*",
    "/blog/:path*",
    "/huong-dan/:path*",
    "/changelog/:path*",
    "/admin/:path*",
  ],
};
