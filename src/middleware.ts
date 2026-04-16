import { NextRequest, NextResponse } from "next/server";
 
// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/settings", "/complete-profile"];
 
// Routes that require admin role (checked server-side via API)
const ADMIN_ROUTES = ["/admin"];
 
// Routes that should redirect logged-in users away
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
 
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
 
  // Get Firebase auth cookie (set by client after login)
  // We use a simple cookie-based check — real verification happens in API routes
  const authToken = request.cookies.get("vgr_auth")?.value;
  const userRole = request.cookies.get("vgr_role")?.value;
  const isLoggedIn = !!authToken;
 
  // Redirect logged-in users away from auth pages
  if (AUTH_ROUTES.some(route => pathname.startsWith(route)) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
 
  // Protect routes that require authentication
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
 
  // Protect admin routes
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
 
  return NextResponse.next();
}
 
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/complete-profile/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
 
