import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function admin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!await admin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const [{ data: subjects, error }, { data: configs }, { data: global }] = await Promise.all([
      db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en"),
      db.from("subject_access_settings").select("subject_id,price_paise,duration_days,is_enabled"),
      db.from("subject_access_global").select("all_subjects_enabled").eq("singleton", true).maybeSingle()
    ]);
    if (error) throw error;
    const map = new Map((configs || []).map((c: any) => [c.subject_id, c]));
    return NextResponse.json({
      all_subjects_enabled: global?.all_subjects_enabled !== false,
      subjects: (subjects || []).map((s: any) => ({ ...s, ...(map.get(s.id) || { price_paise: 2900, duration_days: null, is_enabled: true }) }))
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load access settings." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!await admin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const body = await req.json();
    if (typeof body.all_subjects_enabled === "boolean") {
      const { error } = await db.from("subject_access_global").upsert({
        singleton: true, all_subjects_enabled: body.all_subjects_enabled, updated_at: new Date().toISOString()
      }, { onConflict: "singleton" });
      if (error) throw error;
    }
    if (body.unlock_all === true) {
      const { data: subjects, error: subjectError } = await db.from("subjects").select("id").eq("is_active", true);
      if (subjectError) throw subjectError;
      const updates = (subjects || []).map((s: any) => ({ subject_id: s.id, is_enabled: true, updated_at: new Date().toISOString() }));
      if (updates.length) {
        const { error } = await db.from("subject_access_settings").upsert(updates, { onConflict: "subject_id" });
        if (error) throw error;
      }
    }
    if (Array.isArray(body.subjects)) {
      for (const item of body.subjects) {
        if (!item.subject_id) continue;
        const price = Number(item.price_paise);
        const duration = item.duration_days === null || item.duration_days === "" ? null : Number(item.duration_days);
        if (!Number.isInteger(price) || price < 0 || (duration !== null && (!Number.isInteger(duration) || duration < 1))) {
          return NextResponse.json({ error: "Price or access duration is invalid." }, { status: 400 });
        }
        const { error } = await db.from("subject_access_settings").upsert({
          subject_id: item.subject_id, price_paise: price, duration_days: duration,
          is_enabled: item.is_enabled !== false, updated_at: new Date().toISOString()
        }, { onConflict: "subject_id" });
        if (error) throw error;
      }
    }
    if (body.bulk) {
      const { data: subjects, error: subjectError } = await db.from("subjects").select("id").eq("is_active", true);
      if (subjectError) throw subjectError;
      const updates = (subjects || []).map((s: any) => ({
        subject_id: s.id,
        price_paise: body.bulk.price_paise === undefined ? 2900 : Number(body.bulk.price_paise),
        duration_days: body.bulk.duration_days === undefined ? null : body.bulk.duration_days,
        is_enabled: body.bulk.is_enabled !== false,
        updated_at: new Date().toISOString()
      }));
      if (updates.length) {
        const { error } = await db.from("subject_access_settings").upsert(updates, { onConflict: "subject_id" });
        if (error) throw error;
      }
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not save access settings." }, { status: 500 });
  }
}
