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
    const db = getServiceSupabase();
    const [{ data: subjects, error: subjectError }, { data: global }, { data: accessRows }, { data: configs }] = await Promise.all([
      db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en"),
      db.from("subject_access_global").select("all_subjects_enabled").eq("singleton", true).maybeSingle(),
      db.from("student_subject_access").select("subject_id,expires_at").eq("user_id", user.id),
      db.from("subject_access_settings").select("subject_id,price_paise,duration_days,is_enabled")
    ]);
    if (subjectError) throw subjectError;
    const now = Date.now();
    const accessMap = new Map((accessRows || []).map((a: any) => [a.subject_id, a]));
    const configMap = new Map((configs || []).map((c: any) => [c.subject_id, c]));
    const output = (subjects || []).map((s: any) => {
      const cfg: any = configMap.get(s.id) || { price_paise: 2900, duration_days: null, is_enabled: true };
      const access: any = accessMap.get(s.id);
      const hasAccess = !!access && (!access.expires_at || new Date(access.expires_at).getTime() > now);
      const locked = global?.all_subjects_enabled === false || cfg.is_enabled === false;
      return {
        id: s.id, name_en: s.name_en, name_hi: s.name_hi,
        price_paise: cfg.price_paise, duration_days: cfg.duration_days,
        enabled: !locked, purchased: hasAccess,
        expires_at: access?.expires_at || null,
        can_start: !locked && hasAccess
      };
    });
    return NextResponse.json({ subjects: output, razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load subject access." }, { status: 500 });
  }
}
