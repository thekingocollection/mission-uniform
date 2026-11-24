import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const db = getServiceSupabase();
    const { data, error } = await db.auth.getUser(authorization.slice(7));
    if (error || !data.user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.is_blocked || profile.role !== "student") return NextResponse.json({ success: true });
    const body = await req.json().catch(() => ({}));
    const currentPath = String(body.current_path || "/").slice(0, 300);
    let activeAttemptId: string | null = null;
    const candidate = String(body.active_attempt_id || "");
    if (candidate) {
      const { data: attempt } = await db.from("test_attempts")
        .select("id").eq("id", candidate).eq("user_id", data.user.id).eq("is_submitted", false).maybeSingle();
      if (attempt) activeAttemptId = attempt.id;
    }
    const { error: upsertError } = await db.from("student_live_presence").upsert({
      user_id: data.user.id,
      last_seen_at: new Date().toISOString(),
      current_path: currentPath,
      active_attempt_id: activeAttemptId,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Presence update failed" }, { status: 500 });
  }
}
