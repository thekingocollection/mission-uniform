import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
export const runtime = "nodejs";
async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked,permissions").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.is_blocked || (profile.role !== "super_admin" && !(profile.role === "staff_admin" && profile.permissions?.manage_feedback === true))) return null;
  return true;
}
export async function GET(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ error: "Feedback management permission required." }, { status: 403 });
    const db = getServiceSupabase();
    const { data, error } = await db.from("student_feedback_surveys")
      .select("id,user_id,subject_id,overall_rating,ease_rating,recommendation,favorite_feature,improvement,testimonial,testimonial_consent,reward_expires_at,created_at")
      .order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    const [{ data: profiles }, { data: subjects }] = await Promise.all([
      db.from("profiles").select("id,full_name,email").in("id", (data || []).map((x: any) => x.user_id).slice(0, 1000)),
      db.from("subjects").select("id,name_en,name_hi")
    ]);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s]));
    const rows = (data || []).map((x: any) => ({ ...x, student: profileMap.get(x.user_id) || null, subject: subjectMap.get(x.subject_id) || null }));
    const total = rows.length;
    const avg = (field: string) => total ? Number((rows.reduce((sum: number, x: any) => sum + Number(x[field] || 0), 0) / total).toFixed(2)) : 0;
    return NextResponse.json({ rows, stats: { total, average_rating: avg("overall_rating"), average_ease: avg("ease_rating"), average_recommendation: avg("recommendation"), testimonials: rows.filter((x: any) => x.testimonial_consent && x.testimonial).length } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load feedback." }, { status: 500 }); }
}
