import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { isRegisteredStudentDevice } from "@/lib/verify-student-device";

export const runtime = "nodejs";
async function getStudent(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  if (!(await isRegisteredStudentDevice(req, data.user.id))) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  if (profile?.role !== "student" || profile.is_blocked) return null;
  return data.user;
}
export async function GET(req: NextRequest) {
  try {
    const user = await getStudent(req);
    if (!user) return NextResponse.json({ error: "Please sign in with your student account." }, { status: 401 });
    const db = getServiceSupabase();
    const [{ data: survey }, { data: subjects }] = await Promise.all([
      db.from("student_feedback_surveys").select("id,subject_id,overall_rating,ease_rating,recommendation,favorite_feature,improvement,testimonial,testimonial_consent,reward_expires_at,created_at").eq("user_id", user.id).maybeSingle(),
      db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en")
    ]);
    let access: any = null;
    if (survey?.reward_expires_at) {
      const { data } = await db.from("student_subject_access").select("subject_id,expires_at").eq("user_id", user.id).eq("subject_id", survey.subject_id).maybeSingle();
      access = data;
    }
    return NextResponse.json({ survey: survey || null, subjects: subjects || [], access }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load survey." }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getStudent(req);
    if (!user) return NextResponse.json({ error: "Please sign in with your student account." }, { status: 401 });
    const input = await req.json().catch(() => null);
    const subjectId = String(input?.subject_id || "");
    const overall = Number(input?.overall_rating), ease = Number(input?.ease_rating), recommendation = Number(input?.recommendation);
    const favorite = String(input?.favorite_feature || "").trim().slice(0, 100);
    const improvement = String(input?.improvement || "").trim().slice(0, 1500);
    const testimonial = String(input?.testimonial || "").trim().slice(0, 500);
    const consent = input?.testimonial_consent === true;
    if (!subjectId || !Number.isInteger(overall) || overall < 1 || overall > 5 || !Number.isInteger(ease) || ease < 1 || ease > 5 || !Number.isInteger(recommendation) || recommendation < 0 || recommendation > 10 || !favorite) {
      return NextResponse.json({ error: "Please complete all required survey questions." }, { status: 400 });
    }
    const db = getServiceSupabase();
    const [{ data: subject }, { data: existing }] = await Promise.all([
      db.from("subjects").select("id").eq("id", subjectId).eq("is_active", true).maybeSingle(),
      db.from("student_feedback_surveys").select("id,reward_expires_at").eq("user_id", user.id).maybeSingle()
    ]);
    if (!subject) return NextResponse.json({ error: "Please choose an available subject." }, { status: 400 });
    if (existing) return NextResponse.json({ error: "You have already submitted your feedback survey.", survey_exists: true }, { status: 409 });
    const now = new Date();
    const expiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: accessNow } = await db.from("student_subject_access").select("expires_at").eq("user_id", user.id).eq("subject_id", subjectId).maybeSingle();
    const accessStillActive = !!accessNow && (!accessNow.expires_at || new Date(accessNow.expires_at).getTime() > now.getTime());
    const rewardExpiry = accessStillActive ? null : expiry;
    const { data: survey, error: insertError } = await db.from("student_feedback_surveys").insert({
      user_id: user.id, subject_id: subjectId, overall_rating: overall, ease_rating: ease,
      recommendation, favorite_feature: favorite, improvement, testimonial,
      testimonial_consent: consent, reward_expires_at: rewardExpiry
    }).select("id,subject_id,reward_expires_at,created_at").single();
    if (insertError) {
      if (insertError.code === "23505") return NextResponse.json({ error: "You have already submitted your feedback survey." }, { status: 409 });
      throw insertError;
    }
    if (!accessStillActive) {
      const { error: grantError } = await db.from("student_subject_access").upsert({
        user_id: user.id, subject_id: subjectId, purchased_at: now.toISOString(),
        expires_at: expiry, last_payment_id: null
      }, { onConflict: "user_id,subject_id" });
      if (grantError) throw grantError;
    }
    return NextResponse.json({ success: true, survey, reward_granted: !accessStillActive, reward_expires_at: rewardExpiry });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not submit your feedback." }, { status: 500 }); }
}
