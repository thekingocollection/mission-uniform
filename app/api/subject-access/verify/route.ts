import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    if (!(await isRegisteredStudentDevice(req, user.id))) return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return NextResponse.json({ error: "Payment details are incomplete." }, { status: 400 });
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
    const expected = createHmac("sha256", secret).update(razorpay_order_id + "|" + razorpay_payment_id).digest("hex");
    const a = Buffer.from(expected, "hex"), b = Buffer.from(String(razorpay_signature), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });

    const { data: transaction, error: txError } = await db.from("subject_payment_transactions")
      .select("id,user_id,subject_id,amount_paise,status").eq("razorpay_order_id", razorpay_order_id).eq("user_id", user.id).maybeSingle();
    if (txError || !transaction) return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
    if (transaction.status === "paid") return NextResponse.json({ success: true, message: "Access already activated." });

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
    const paymentResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(razorpay_payment_id), {
      headers: { Authorization: "Basic " + Buffer.from(keyId + ":" + secret).toString("base64") }
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== razorpay_order_id || payment.status !== "captured" || payment.amount !== transaction.amount_paise || payment.currency !== "INR") {
      return NextResponse.json({ error: "Payment is not captured or does not match this order." }, { status: 400 });
    }

    const [{ data: cfg }, { data: global }] = await Promise.all([
      db.from("subject_access_settings").select("duration_days").eq("subject_id", transaction.subject_id).maybeSingle(),
      db.from("subject_access_global").select("all_subjects_enabled").eq("singleton", true).maybeSingle()
    ]);
    const durationDays = cfg?.duration_days ?? null;
    const purchasedAt = new Date();
    const expiresAt = durationDays ? new Date(purchasedAt.getTime() + durationDays * 86400000).toISOString() : null;
    const { error: updateError } = await db.from("subject_payment_transactions").update({
      status: "paid", razorpay_payment_id, paid_at: purchasedAt.toISOString(), product_name: "Subject Premium", access_duration_days: durationDays, access_expires_at: expiresAt
    }).eq("id", transaction.id).eq("status", "created");
    if (updateError) throw updateError;
    const { error: accessError } = await db.from("student_subject_access").upsert({
      user_id: user.id, subject_id: transaction.subject_id, purchased_at: purchasedAt.toISOString(),
      expires_at: expiresAt, last_payment_id: razorpay_payment_id
    }, { onConflict: "user_id,subject_id" });
    if (accessError) throw accessError;
    const enabled = global?.all_subjects_enabled !== false;
    return NextResponse.json({ success: true, expires_at: expiresAt, temporarily_locked: !enabled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Payment verification failed." }, { status: 500 });
  }
}
