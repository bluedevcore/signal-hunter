import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, validSession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    // Never serve the CRM publicly without a password.
    if (process.env.VERCEL) return new NextResponse("Set APP_PASSWORD and AUTH_SECRET in Vercel, then redeploy.", { status: 503 });
    return NextResponse.next(); // local dev: no login
  }
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();
  if (await validSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
