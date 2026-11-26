import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records a real referral landing visit once per browser session key.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const visitorKey = String(body.visitor_key || "").trim().slice(0, 80);
    const landingPath = String(body.landing_path || "/signup").startsWith("/signup") ? "/signup" : "/signup";
    if (!code || !visitorKey) return NextResponse.json({ tracked: false }, { status: 400 });
    const db = getServiceSupabase();
    const { data: partner, error } = await db.from("partners").select("id").eq("referral_code", code).eq("status", "approved").maybeSingle();
    if (error) throw error;
    if (!partner) return NextResponse.json({ tracked: false }, { status: 404 });
    const { error: insertError } = await db.from("partner_clicks").upsert(
      { partner_id: partner.id, visitor_key: visitorKey, landing_path: landingPath },
      { onConflict: "partner_id,visitor_key", ignoreDuplicates: true }
    );
    if (insertError) throw insertError;
    return NextResponse.json({ tracked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ tracked: false }, { status: 200 });
  }
}
