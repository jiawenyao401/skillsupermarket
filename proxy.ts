import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { safeReturnTo, emailVerificationDestination } from "@/lib/auth-utils";

export async function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "skill-market" });

  if (!sessionCookie) {
    if (isLoginPage) return NextResponse.next();
    const loginURL = new URL("/login", request.url);
    loginURL.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginURL);
  }

  // Only matched authentication-boundary routes reach this database check.
  // It prevents a forged/expired cookie from bypassing the gate or creating a
  // login ↔ evaluate redirect loop.
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    if (isLoginPage) return NextResponse.next();
    const loginURL = new URL("/login", request.url);
    loginURL.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginURL);
  }

  if (isLoginPage) {
    const destination = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
    return NextResponse.redirect(new URL(session.user.emailVerified ? destination : emailVerificationDestination(destination), request.url));
  }

  if (request.nextUrl.pathname === "/evaluate" && !session.user.emailVerified) {
    return NextResponse.redirect(new URL(emailVerificationDestination(`${request.nextUrl.pathname}${request.nextUrl.search}`), request.url));
  }

  return NextResponse.next();
}

// Authentication is resolved before either page starts streaming, preventing
// an authenticated /login request from rendering an empty layout shell.
export const config = {
  matcher: ["/evaluate", "/account", "/admin/:path*", "/login"],
};
