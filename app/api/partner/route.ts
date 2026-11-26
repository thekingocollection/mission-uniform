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
    // Lightweight authentication check used by the shared login page.
    // Do not load dashboard tables until the partner enters the workspace.
    if (new URL(req.url).searchParams.get("verify") === "1") {
      return NextResponse.json({ partner }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const [{ data: referrals, error: referralsError }, { data: commissions, error: commissionsError }, { data: payouts, error: payoutsError }, { data: clicks, error: clicksError }, { data: payoutRequests, error: payoutRequestsError }] = await Promise.all([
      db.from("partner_referrals").select("id,student_id,created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
      db.from("partner_commissions").select("id,amount_paise,commission_rate,commission_paise,status,created_at,paid_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
      db.from("partner_payouts").select("amount_paise,paid_at,payment_reference").eq("partner_id", partner.id).order("paid_at", { ascending: false }).limit(100)
    ]);
    if (referralsError) throw referralsError;
    if (commissionsError) throw commissionsError;
    if (payoutsError) throw payoutsError;\n    if (clicksError) throw clicksError;\n    if (payoutRequestsError) throw payoutRequestsError;
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
    return NextResponse.json({ partner, summary, referrals: referralRows, commissions: rows, payouts: payouts || [], clicks: clicks || [], payoutRequests: payoutRequests || [] }, { headers: { "Cache-Control": "private, no-store" } });
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
\n
export async function POST(req: NextRequest) {
  try {
    const auth = await currentUser(req);
    if (!auth) return NextResponse.json({ error: "Please login first." }, { status: 401 });
    const { db, user } = auth;
    const { data: partner, error: partnerError } = await db.from("partners").select("id,status").eq("user_id", user.id).maybeSingle();
    if (partnerError) throw partnerError;
    if (!partner || partner.status !== "approved") return NextResponse.json({ error: "Only approved partners can request a payout." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const amountPaise = Math.round(Number(body.amount_rupees) * 100);
    const method = String(body.payout_method || "");
    const details = body.payout_details && typeof body.payout_details === "object" ? body.payout_details : {};
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 10000) return NextResponse.json({ error: "Minimum payout request is ₹100." }, { status: 400 });
    if (!["upi","bank"].includes(method)) return NextResponse.json({ error: "Choose UPI or bank transfer." }, { status: 400 });
    if (method === "upi" && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(String(details.upi_id || "").trim())) return NextResponse.json({ error: "Enter a valid UPI ID." }, { status: 400 });
    if (method === "bank" && (String(details.account_holder || "").trim().length < 2 || !/^\d{9,18}$/.test(String(details.account_number || "")) || String(details.ifsc || "").trim().length !== 11)) return NextResponse.json({ error: "Enter account holder, valid account number and 11-character IFSC." }, { status: 400 });
    const [{ data: commissions, error: commissionError }, { data: requests, error: requestError }, { data: payouts, error: payoutError }] = await Promise.all([
      db.from("partner_commissions").select("commission_paise,status").eq("partner_id", partner.id).neq("status","reversed"),
      db.from("partner_payout_requests").select("amount_paise,status").eq("partner_id", partner.id).in("status",["requested","approved"]),
      db.from("partner_payouts").select("amount_paise").eq("partner_id", partner.id)
    ]);
    if (commissionError) throw commissionError; if (requestError) throw requestError; if (payoutError) throw payoutError;
    const earned = (commissions || []).reduce((sum:number,row:any)=>sum+Number(row.commission_paise||0),0);
    const paid = (payouts || []).reduce((sum:number,row:any)=>sum+Number(row.amount_paise||0),0);
    const reserved = (requests || []).reduce((sum:number,row:any)=>sum+Number(row.amount_paise||0),0);
    const available = earned - paid - reserved;
    if (amountPaise !== available || available <= 0) return NextResponse.json({ error: "For accurate reconciliation, request the full available balance of " + Math.max(0,available/100).toLocaleString("en-IN",{style:"currency",currency:"INR"}) + "." }, { status: 400 });
    const { data: created, error } = await db.from("partner_payout_requests").insert({
      partner_id: partner.id, amount_paise: amountPaise, payout_method: method,
      payout_details: details, note: String(body.note || "").trim().slice(0,500) || null
    }).select("id,amount_paise,payout_method,status,requested_at").single();
    if (error) throw error;
    return NextResponse.json({ success: true, request: created }, { headers: { "Cache-Control": "no-store" } });
  } catch (e:any) { return NextResponse.json({ error: e.message || "Could not submit payout request." }, { status: 500 }); }
}
