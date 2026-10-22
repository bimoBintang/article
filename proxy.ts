import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "./lib/auth";
import {
  VISITOR_COOKIE,
  generateVisitorKey,
  getClientIp,
  trackVisit,
} from "./lib/visitor";

export const config = {
  // Abaikan asset statis & file dengan ekstensi
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

/**
 * Proxy (menggantikan middleware) untuk:
 * 1. Melindungi route /admin
 * 2. Melacak kunjungan visitor (device, browser, OS, IP)
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // ---------- 1. Proteksi route admin ----------
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(sessionOptions.cookieName)?.value;
    let isLoggedIn = false;
    let role = "";

    if (sessionCookie) {
      try {
        // unsealData = verifikasi read-only, tidak butuh cookie store
        const session = await unsealData<SessionData>(sessionCookie, {
          password: sessionOptions.password,
          ttl: sessionOptions.ttl,
        });
        isLoggedIn = session.isLoggedIn === true;
        role = session.role || "";
      } catch {
        // cookie rusak / tidak bisa di-unseal -> dianggap belum login
      }
    }

    if (!isLoggedIn || role !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ---------- 2. Pelacakan visitor ----------
  const response = NextResponse.next();

  let visitorKey = request.cookies.get(VISITOR_COOKIE)?.value;

  if (!visitorKey) {
    visitorKey = generateVisitorKey();
    response.cookies.set(VISITOR_COOKIE, visitorKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 180, // berlaku 180 hari
      path: "/",
    });
  }

  // Hanya lacak halaman (bukan request API / asset)
  // /bayar memuat token rahasia di path-nya dan /login tidak berguna untuk analitik
  const isTrackable =
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/bayar") &&
    !pathname.startsWith("/login");

  if (isTrackable) {
    const ipAddress = getClientIp(request.headers);
    const userAgent = request.headers.get("user-agent");
    const referrer = request.headers.get("referer");

    // Background work: respons tetap cepat, pencatatan selesai di belakang
    event.waitUntil(
      trackVisit({
        visitorKey,
        path: pathname,
        userAgent,
        ipAddress,
        referrer,
      }).catch((err) => console.error("trackVisit error:", err))
    );
  }

  return response;
}
