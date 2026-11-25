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
  return profile?.role === "super_admin" && !profile.is_blocked ? db : null;
}

export async function POST(req: NextRequest) {
  let createdUserId: string | null = null;
  try {
    const db = await adminDb(req);
    if (!db) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    const password = String(body.password || "");
    const code = String(body.referral_code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    const rate = Number(body.commission_rate);
    if (name.length < 2) return NextResponse.json({ error: "Enter partner name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!/^[6-9]\d{9}$/.test(phone)) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    if (!code || !/^[A-Z0-9]{3,20}$/.test(code)) return NextResponse.json({ error: "Referral code must be 3–20 letters or numbers." }, { status: 400 });
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return NextResponse.json({ error: "Set a commission percentage between 0 and 100." }, { status: 400 });
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name, phone, account_type: "partner" }
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("Could not create partner login.");
    createdUserId = created.user.id;
    const { data: profile, error: profileError } = await db.from("profiles").select("id").eq("id", createdUserId).maybeSingle();
    if (profileError || !profile) throw new Error("Partner account was created, but its profile is not ready. Contact support before retrying.");
    const { data: partner, error: partnerError } = await db.from("partners").insert({
      user_id: createdUserId, display_name: name, referral_code: code,
      status: "approved", commission_rate: rate, approved_at: new Date().toISOString()
    }).select("id,display_name,referral_code,status,commission_rate").single();
    if (partnerError) throw partnerError;
    return NextResponse.json({ success: true, partner, credentials: { email, password }, login_url: "/partner/login" });
  } catch (e: any) {
    if (createdUserId) {
      try { const db = getServiceSupabase(); await db.auth.admin.deleteUser(createdUserId); } catch {}
    }
    return NextResponse.json({ error: e.message || "Could not create partner account." }, { status: 500 });
  }
}
