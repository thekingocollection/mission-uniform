import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    const { subject_id } = await req.json();
    if (!subject_id) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    const [{ data: subject }, { data: cfg }, { data: global }] = await Promise.all([
      db.from("subjects").select("id,name_en,name_hi").eq("id", subject_id).eq("is_active", true).single(),
      db.from("subject_access_settings").select("price_paise,is_enabled").eq("subject_id", subject_id).maybeSingle(),
      db.from("subject_access_global").select("all_subjects_enabled").eq("singleton", true).maybeSingle()
    ]);
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });
    if (global?.all_subjects_enabled === false || cfg?.is_enabled === false) return NextResponse.json({ error: "This subject is currently locked by Admin." }, { status: 403 });
    const { data: current } = await db.from("student_subject_access").select("expires_at").eq("user_id", user.id).eq("subject_id", subject_id).maybeSingle();
    if (current && (!current.expires_at || new Date(current.expires_at).getTime() > Date.now())) return NextResponse.json({ error: "You already have active access to this subject." }, { status: 409 });

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Online payment is not configured yet. Please contact support." }, { status: 503 });
    const amount = cfg?.price_paise ?? 2900;
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", receipt: ("mu_" + user.id.slice(0, 8) + "_" + Date.now()).slice(0, 40), notes: { user_id: user.id, subject_id } })
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) return NextResponse.json({ error: order.error?.description || "Could not create payment order." }, { status: 502 });
    const { error: saveError } = await db.from("subject_payment_transactions").insert({
      user_id: user.id, subject_id, amount_paise: amount, razorpay_order_id: order.id, status: "created"
    });
    if (saveError) throw saveError;
    return NextResponse.json({ order_id: order.id, amount, currency: "INR", key_id: keyId, subject_name: subject.name_en || subject.name_hi || "Subject" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unable to create payment." }, { status: 500 });
  }
}
