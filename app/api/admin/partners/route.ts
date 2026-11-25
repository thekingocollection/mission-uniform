import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminDb(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? { db, user: data.user } : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await adminDb(req);
    if (!auth) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const { data, error } = await auth.db.from("partners").select("*,profiles:user_id(full_name,student_code)").order("created_at", { ascending: false });
    if (error) throw error;
    const ids = (data || []).map((p: any) => p.id);
    const [{ data: refs, error: refsError }, { data: commissions, error: commissionsError }] = await Promise.all([
      ids.length ? auth.db.from("partner_referrals").select("partner_id,id").in("partner_id", ids) : Promise.resolve({ data: [], error: null } as any),
      ids.length ? auth.db.from("partner_commissions").select("partner_id,commission_paise,status").in("partner_id", ids) : Promise.resolve({ data: [], error: null } as any)
    ]);
    if (refsError) throw refsError;
    if (commissionsError) throw commissionsError;
    const partners = (data || []).map((p: any) => {
      const pc = (commissions || []).filter((c: any) => c.partner_id === p.id);
      return { ...p, referral_count: (refs || []).filter((r: any) => r.partner_id === p.id).length,
        premium_count: pc.length, commission_paise: pc.filter((c: any) => c.status !== "reversed").reduce((s: number,c: any)=>s+Number(c.commission_paise||0),0) };
    });
    return NextResponse.json({ partners }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load partners." }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await adminDb(req);
    if (!auth) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await req.json();
    const id = String(body.id || "");
    const status = String(body.status || "");
    const rate = Number(body.commission_rate);
    const code = String(body.referral_code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    if (!id || !["approved","rejected","inactive","pending"].includes(status)) return NextResponse.json({ error: "Invalid partner update." }, { status: 400 });
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return NextResponse.json({ error: "Commission must be between 0 and 100 percent." }, { status: 400 });
    if (status === "approved" && (!code || rate <= 0)) return NextResponse.json({ error: "Set a referral code and commission rate before approval." }, { status: 400 });
    const { data, error } = await auth.db.from("partners").update({
      status, commission_rate: rate, referral_code: code || null,
      approved_at: status === "approved" ? new Date().toISOString() : null
    }).eq("id", id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ success: true, partner: data });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not update partner." }, { status: 500 }); }
}
