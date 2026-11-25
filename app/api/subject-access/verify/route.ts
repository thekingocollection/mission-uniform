import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    const user = authData.user;
    if (authError || !user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    if (!(await isRegisteredStudentDevice(req, user.id))) {
      return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    }

    const body = await req.json();
    const razorpay_order_id = String(body.razorpay_order_id || "");
    const razorpay_payment_id = String(body.razorpay_payment_id || "");
    const razorpay_signature = String(body.razorpay_signature || "");
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Payment details are incomplete." }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !secret) {
      return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
    }

    const expected = createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    const expectedBytes = Buffer.from(expected, "hex");
    const receivedBytes = Buffer.from(razorpay_signature, "hex");
    if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const { data: transaction, error: txError } = await db
      .from("subject_payment_transactions")
      .select("id,user_id,subject_id,amount_paise,status,razorpay_payment_id")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (txError || !transaction) {
      return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
    }

    const paymentResponse = await fetch(
      "https://api.razorpay.com/v1/payments/" + encodeURIComponent(razorpay_payment_id),
      {
        headers: {
          Authorization: "Basic " + Buffer.from(keyId + ":" + secret).toString("base64")
        },
        cache: "no-store"
      }
    );
    const payment = await paymentResponse.json().catch(() => ({}));

    if (
      !paymentResponse.ok ||
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      payment.amount !== transaction.amount_paise ||
      payment.currency !== "INR"
    ) {
      return NextResponse.json(
        { error: "Payment is not captured or does not match this order." },
        { status: 400 }
      );
    }

    const { data: activation, error: activationError } = await db.rpc("activate_subject_purchase", {
      p_order_id: razorpay_order_id,
      p_payment_id: razorpay_payment_id,
      p_user_id: user.id,
      p_amount_paise: transaction.amount_paise,
      p_paid_at: new Date().toISOString()
    });

    if (activationError) throw activationError;
    if (!activation?.success) throw new Error("Payment was verified but subject access could not be activated.");

    const { data: global } = await db
      .from("subject_access_global")
      .select("all_subjects_enabled")
      .eq("singleton", true)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      expires_at: activation.expires_at || null,
      temporarily_locked: global?.all_subjects_enabled === false,
      already_paid: Boolean(activation.already_paid)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Payment verification failed. If money was deducted, contact support." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
