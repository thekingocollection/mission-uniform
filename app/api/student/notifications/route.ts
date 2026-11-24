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
  if (profile?.role !== "student" || profile.is_blocked) return null;
  return data.user;
}
export async function GET(req: NextRequest) {
  const user = await student(req);
  if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
  const db = getServiceSupabase();
  const { data, error } = await db.from("student_notifications").select("id,title,body,target_url,created_at,read_at,clicked_at,push_status").eq("user_id", user.id).eq("inapp_visible", true).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data || [], unread_count: (data || []).filter((n: any) => !n.read_at).length }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PATCH(req: NextRequest) {
  const user = await student(req);
  if (!user) return NextResponse.json({ error: "Student login required." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  const action = String(body?.action || "");
  if (!id || !["read", "click"].includes(action)) return NextResponse.json({ error: "Invalid notification action." }, { status: 400 });
  const db = getServiceSupabase();
  const patch = action === "read" ? { read_at: new Date().toISOString() } : { clicked_at: new Date().toISOString(), read_at: new Date().toISOString() };
  const { data, error } = await db.from("student_notifications").update(patch).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
