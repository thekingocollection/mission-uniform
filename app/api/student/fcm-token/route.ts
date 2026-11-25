import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

async function getStudent(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "student" && !profile.is_blocked ? data.user : null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getStudent(req);
    if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (token.length < 40 || token.length > 4096) {
      return NextResponse.json({ error: "Invalid Firebase messaging token." }, { status: 400 });
    }
    const db = getServiceSupabase();
    const { error } = await db.from("student_fcm_tokens").upsert({
      user_id: user.id,
      token,
      platform: String(body?.platform || "web").slice(0, 30),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      updated_at: new Date().toISOString()
    }, { onConflict: "token" });
    if (error) {
      console.error("FCM token save failed:", error.message);
      return NextResponse.json({ error: "Could not save notification registration." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FCM registration error:", error);
    return NextResponse.json({ error: "Notification registration is temporarily unavailable." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getStudent(req);
    if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) return NextResponse.json({ error: "Token is required." }, { status: 400 });
    const db = getServiceSupabase();
    const { error } = await db.from("student_fcm_tokens").delete().eq("user_id", user.id).eq("token", token);
    if (error) return NextResponse.json({ error: "Could not remove notification registration." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Notification removal is temporarily unavailable." }, { status: 500 });
  }
}
