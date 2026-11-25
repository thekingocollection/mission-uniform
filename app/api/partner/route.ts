import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  return { db, user: data.user };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await currentUser(req);
    if (!auth) return NextResponse.json({ error: "Please login first." }, { status: 401 });
    const { db, user } = auth;
    const { data: partner, error } = await db.from("partners").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!partner) return NextResponse.json({ partner: null, summary: null, referrals: [], commissions: [] });
    const [{ data: referrals, error: referralsError }, { data: commissions, error: commissionsError }, { data: payouts, error: payoutsError }] = await Promise.all([
      db.from("partner_referrals").select("id,student_id,created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
      db.from("partner_commissions").select("id,amount_paise,commission_rate,commission_paise,status,created_at,paid_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
      db.from("partner_payouts").select("amount_paise,paid_at,payment_reference").eq("partner_id", partner.id).order("paid_at", { ascending: false }).limit(100)
    ]);
    if (referralsError) throw referralsError;
    if (commissionsError) throw commissionsError;
    if (payoutsError) throw payoutsError;
    const studentIds = (referrals || []).map((r: any) => r.student_id);
    const profileResult = studentIds.length ? await db.from("profiles").select("id,full_name,student_code").in("id", studentIds) : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const profileById = new Map((profileResult.data || []).map((p: any) => [p.id, p]));
    const referralRows = (referrals || []).map((r: any) => ({ ...r, profiles: profileById.get(r.student_id) || null }));
    const rows = commissions || [];
    const summary = {
      students: referralRows.length,
      premiumSales: rows.length,
      earnedPaise: rows.filter((r: any) => r.status !== "reversed").reduce((s: number, r: any) => s + Number(r.commission_paise || 0), 0),
      pendingPaise: rows.filter((r: any) => ["pending","approved"].includes(r.status)).reduce((s: number, r: any) => s + Number(r.commission_paise || 0), 0),
      paidPaise: rows.filter((r: any) => r.status === "paid").reduce((s: number, r: any) => s + Number(r.commission_paise || 0), 0)
    };
    return NextResponse.json({ partner, summary, referrals: referralRows, commissions: rows, payouts: payouts || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load partner dashboard." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await currentUser(req);
    if (!auth) return NextResponse.json({ error: "Please login first." }, { status: 401 });
    const { db, user } = auth;
    const { data: existing } = await db.from("partners").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) return NextResponse.json({ error: "Your partnership request already exists." }, { status: 409 });
    const body = await req.json().catch(() => ({}));
    const name = String(body.display_name || user.user_metadata?.full_name || "").trim().slice(0, 80);
    if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    const { error } = await db.from("partners").insert({ user_id: user.id, display_name: name, status: "pending", commission_rate: 0 });
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Partnership request sent. Admin will contact you after review." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not submit partnership request." }, { status: 500 });
  }
}
