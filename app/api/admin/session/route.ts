import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Your admin session is missing. Please sign in again." }, { status: 401 });
    }
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Your login session has expired. Please sign in again." }, { status: 401 });
    }
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,role,is_blocked,permissions,full_name,email")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("ADMIN_SESSION_PROFILE_ERROR", profileError);
      return NextResponse.json({ error: "Could not verify your administrator profile. Please try again." }, { status: 503 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Your account has no administrator profile. Ask the Super Admin to assign admin access." }, { status: 403 });
    }
    if (profile.is_blocked) {
      return NextResponse.json({ error: "This administrator account is blocked. Contact the Super Admin." }, { status: 403 });
    }
    if (profile.role !== "super_admin" && profile.role !== "staff_admin") {
      return NextResponse.json({ error: "This account is not assigned an administrator or staff role." }, { status: 403 });
    }
    const permissions = profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
    if (profile.role === "staff_admin" && !Object.values(permissions).some(value => value === true)) {
      return NextResponse.json({ error: "Your staff account has no active permissions. Ask the Super Admin to assign access." }, { status: 403 });
    }
    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email: authData.user.email || profile.email || "", full_name: profile.full_name || "" },
      profile: { role: profile.role, permissions }
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("ADMIN_SESSION_VERIFY_ERROR", error);
    return NextResponse.json({ error: "Administrator verification is temporarily unavailable. Please retry." }, { status: 503 });
  }
}
