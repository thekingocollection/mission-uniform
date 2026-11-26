import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSuperAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? db : null;
}

export async function GET(req: NextRequest) {
  try {
    const db = await requireSuperAdmin(req);
    if (!db) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });

    const now = new Date();
    const IST_OFFSET_MS = 330 * 60 * 1000;
    const indiaNow = new Date(now.getTime() + IST_OFFSET_MS);
    indiaNow.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(indiaNow.getTime() - IST_OFFSET_MS).toISOString();

    const { data: partners, error: partnerError } = await db
      .from("partners")
      .select("id,display_name,referral_code,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (partnerError) throw partnerError;

    const partnerIds = (partners || []).map((p: any) => p.id);
    const [clickTotals, referralTotals, todayClicks, todayReferrals, recentClicks, recentReferrals] = await Promise.all([
      ...partnerIds.map((id: string) => db.from("partner_clicks").select("id", { count: "exact", head: true }).eq("partner_id", id)),
      ...partnerIds.map((id: string) => db.from("partner_referrals").select("id", { count: "exact", head: true }).eq("partner_id", id)),
      db.from("partner_clicks").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
      db.from("partner_referrals").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
      db.from("partner_clicks").select("id,partner_id,created_at,landing_path").order("created_at", { ascending: false }).limit(40),
      db.from("partner_referrals").select("id,partner_id,created_at").order("created_at", { ascending: false }).limit(40)
    ]);

    const n = partnerIds.length;
    const errors = [...clickTotals.slice(0, n), ...referralTotals.slice(n), todayClicks, todayReferrals, recentClicks, recentReferrals].filter((x: any) => x.error);
    if (errors.length) throw errors[0].error;

    const byPartner = new Map<string, any>();
    (partners || []).forEach((p: any, i: number) => {
      const clicks = clickTotals[i]?.count || 0;
      const registrations = referralTotals[i]?.count || 0;
      byPartner.set(p.id, {
        id: p.id, name: p.display_name, code: p.referral_code || "—", status: p.status,
        clicks, registrations, conversion_rate: clicks ? Number((registrations / clicks * 100).toFixed(1)) : 0,
        clicks_today: 0, registrations_today: 0
      });
    });

    // Today counters are derived from a bounded, recent activity query; lifetime totals above use exact database counts.
    const [clicksTodayRows, referralsTodayRows] = await Promise.all([
      db.from("partner_clicks").select("partner_id").gte("created_at", dayStart).limit(10000),
      db.from("partner_referrals").select("partner_id").gte("created_at", dayStart).limit(10000)
    ]);
    if (clicksTodayRows.error || referralsTodayRows.error) throw clicksTodayRows.error || referralsTodayRows.error;
    for (const row of clicksTodayRows.data || []) { const p = byPartner.get(row.partner_id); if (p) p.clicks_today++; }
    for (const row of referralsTodayRows.data || []) { const p = byPartner.get(row.partner_id); if (p) p.registrations_today++; }

    const partnerName = new Map((partners || []).map((p: any) => [p.id, p.display_name]));
    const activity = [
      ...(recentClicks.data || []).map((x: any) => ({ id: "click-" + x.id, kind: "click", partner_id: x.partner_id, partner: partnerName.get(x.partner_id) || "Partner", at: x.created_at, detail: "Referral link clicked", meta: x.landing_path || "/signup" })),
      ...(recentReferrals.data || []).map((x: any) => ({ id: "registration-" + x.id, kind: "registration", partner_id: x.partner_id, partner: partnerName.get(x.partner_id) || "Partner", at: x.created_at, detail: "New student registered", meta: "Referral attributed" }))
    ].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);

    const rows = [...byPartner.values()].sort((a, b) => b.clicks - a.clicks);
    const totals = rows.reduce((acc, p) => ({
      clicks: acc.clicks + p.clicks,
      registrations: acc.registrations + p.registrations,
      clicks_today: acc.clicks_today + p.clicks_today,
      registrations_today: acc.registrations_today + p.registrations_today
    }), { clicks: 0, registrations: 0, clicks_today: 0, registrations_today: 0 });

    return NextResponse.json({
      totals: { ...totals, conversion_rate: totals.clicks ? Number((totals.registrations / totals.clicks * 100).toFixed(1)) : 0, partners: rows.length },
      partners: rows, activity, refreshed_at: now.toISOString()
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Partner analytics could not load." }, { status: 500 });
  }
}
