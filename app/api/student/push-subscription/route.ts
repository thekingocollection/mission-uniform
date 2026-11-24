import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
export const runtime = "nodejs";
async function student(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "student" && !profile.is_blocked ? data.user : null;
}
export async function POST(req: NextRequest) {
  const user = await student(req);
  if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = String(body?.endpoint || "");
  const p256dh = String(body?.keys?.p256dh || "");
  const authKey = String(body?.keys?.auth || "");
  if (!endpoint.startsWith("https://") || !p256dh || !authKey) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  const db = getServiceSupabase();
  const { error } = await db.from("student_push_subscriptions").upsert({
    user_id: user.id, endpoint, p256dh, auth_key: authKey, user_agent: req.headers.get("user-agent")?.slice(0, 500) || null, updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
export async function DELETE(req: NextRequest) {
  const user = await student(req);
  if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = String(body?.endpoint || "");
  if (!endpoint.startsWith("https://")) return NextResponse.json({ error: "Invalid endpoint." }, { status: 400 });
  const db = getServiceSupabase();
  const { error } = await db.from("student_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
