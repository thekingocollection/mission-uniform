import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { filterExamSubjects } from "@/lib/exam-subjects";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function getUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  return error ? null : data.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    if (!(await isRegisteredStudentDevice(req, user.id))) return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    const db = getServiceSupabase();
    const [{ data: subjects, error: subjectError }, { data: global }, { data: configs }, { data: purchases }] = await Promise.all([
      db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en"),
      db.from("subject_access_global").select("all_subjects_enabled").eq("singleton", true).maybeSingle(),
      db.from("subject_access_settings").select("subject_id,price_paise,duration_days,is_enabled"),
      db.from("student_subject_access").select("subject_id,expires_at").eq("user_id", user.id)
    ]);
    if (subjectError) throw subjectError;
    const allowedSubjects = filterExamSubjects(subjects || []);
    const configMap = new Map((configs || []).map((c: any) => [c.subject_id, c]));
    const purchaseMap = new Map((purchases || []).map((p: any) => [p.subject_id, p]));
    const trialExpiresAt = new Date(new Date(user.created_at).getTime() + 24 * 60 * 60 * 1000);
    const trialActive = Number.isFinite(trialExpiresAt.getTime()) && trialExpiresAt.getTime() > Date.now();
    const output = allowedSubjects.map((s: any) => {
      const cfg: any = configMap.get(s.id) || { price_paise: 2900, duration_days: null, is_enabled: true };
      const locked = global?.all_subjects_enabled === false || cfg.is_enabled === false;
      const purchase: any = purchaseMap.get(s.id);
      const purchased = Boolean(purchase && (!purchase.expires_at || new Date(purchase.expires_at).getTime() > Date.now()));
      const freeForever = Number(cfg.price_paise) === 0;
      const trial = trialActive && !purchased;
      return {
        id: s.id, name_en: s.name_en, name_hi: s.name_hi,
        price_paise: cfg.price_paise, duration_days: cfg.duration_days,
        enabled: !locked, purchased, trial_active: trial, free_forever: freeForever,
        expires_at: purchase?.expires_at || null,
        can_start: !locked && (purchased || trial || freeForever)
      };
    });
    return NextResponse.json({ subjects: output, trial_active: trialActive, trial_expires_at: trialExpiresAt.toISOString(), razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load subject access." }, { status: 500 });
  }
}
