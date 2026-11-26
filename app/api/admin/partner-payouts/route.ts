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
  const auth = await adminDb(req);
  if (!auth) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  const { data, error } = await auth.db.from("partner_payout_requests").select("*,partners(id,display_name,referral_code,user_id)").order("requested_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest) {
  const auth = await adminDb(req);
  if (!auth) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
  try {
    const body = await req.json();
    const id = String(body.id || "");
    const action = String(body.action || "");
    const adminNote = String(body.admin_note || "").trim().slice(0, 500) || null;
    if (!id || !["approve","reject","paid"].includes(action)) return NextResponse.json({ error: "Invalid payout action." }, { status: 400 });
    const { data: request, error: requestError } = await auth.db.from("partner_payout_requests").select("*").eq("id", id).maybeSingle();
    if (requestError) throw requestError;
    if (!request) return NextResponse.json({ error: "Payout request not found." }, { status: 404 });
    if (["paid","rejected"].includes(request.status)) return NextResponse.json({ error: "This request has already been closed." }, { status: 409 });
    if (action === "approve") {
      const { data, error } = await auth.db.from("partner_payout_requests").update({ status: "approved", admin_note: adminNote, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id }).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, request: data });
    }
    if (action === "reject") {
      const { data, error } = await auth.db.from("partner_payout_requests").update({ status: "rejected", admin_note: adminNote, reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id }).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, request: data });
    }
    const paymentReference = String(body.payment_reference || "").trim().slice(0, 120);
    if (!paymentReference) return NextResponse.json({ error: "Enter the verified bank/UPI transaction reference before marking paid." }, { status: 400 });
    if (request.status !== "approved") return NextResponse.json({ error: "Approve this payout request before marking it paid." }, { status: 409 });
    const { data: commissions, error: commissionsError } = await auth.db.from("partner_commissions").select("id,commission_paise,status").eq("partner_id", request.partner_id).neq("status","reversed").neq("status","paid").order("created_at", { ascending: true });
    if (commissionsError) throw commissionsError;
    const due = (commissions || []).reduce((sum:number,row:any)=>sum+Number(row.commission_paise||0),0);
    if (due !== Number(request.amount_paise)) return NextResponse.json({ error: "Outstanding commission no longer matches this request. Refresh and reconcile before paying." }, { status: 409 });
    const { error: payoutError } = await auth.db.from("partner_payouts").insert({ partner_id: request.partner_id, amount_paise: request.amount_paise, payment_reference: paymentReference, notes: adminNote, paid_by: auth.user.id, paid_at: new Date().toISOString() });
    if (payoutError) throw payoutError;
    if ((commissions || []).length) {
      const { error: updateError } = await auth.db.from("partner_commissions").update({ status: "paid", paid_at: new Date().toISOString() }).in("id", (commissions || []).map((row:any)=>row.id));
      if (updateError) throw updateError;
    }
    const { data, error } = await auth.db.from("partner_payout_requests").update({ status: "paid", payment_reference: paymentReference, admin_note: adminNote, paid_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, request: data });
  } catch (e:any) { return NextResponse.json({ error: e.message || "Could not update payout request." }, { status: 500 }); }
}
