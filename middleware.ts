import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/login", "/signup", "/about", "/contact", "/privacy-policy", "/terms"];
function isPublicPath(pathname: string) { return publicPaths.includes(pathname); }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/api/")) return NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    const loginUrl = new URL("/login", request.url); loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    const loginUrl = new URL("/login", request.url); loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  const deviceId = request.cookies.get("mu_device_id")?.value;
  if (!deviceId) {
    const loginUrl = new URL("/login", request.url); loginUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  const { data: deviceAllowed, error: deviceError } = await supabase.rpc("check_student_device", { p_device_id: deviceId });
  if (deviceError || deviceAllowed !== true) {
    const loginUrl = new URL("/login", request.url); loginUrl.searchParams.set("next", pathname); loginUrl.searchParams.set("device", "blocked");
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
