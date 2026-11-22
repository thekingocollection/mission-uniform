import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Please login again." }, { status: 401 });

    const { order_id, payment_id, signature, device_id } = await request.json();
    if (![order_id, payment_id, signature, device_id].every(value => typeof value === "string" && value.length > 0)) {
      return NextResponse.json({ error: "Payment verification details are incomplete." }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Payment is not configured." }, { status: 503 });

    const expected = createHmac("sha256", keySecret).update(order_id + "|" + payment_id).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data: payment, error: paymentError } = await db.from("student_device_payments")
      .select("id,user_id,device_id,amount_paise,status")
      .eq("user_id", user.id).eq("razorpay_order_id", order_id).eq("device_id", device_id).maybeSingle();
    if (paymentError || !payment || payment.amount_paise !== 1900) {
      return NextResponse.json({ error: "Payment order not found for this device." }, { status: 404 });
    }

    const razorpayAuth = "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64");
    const razorpayPaymentResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(payment_id), {
      headers: { "Authorization": razorpayAuth },
      cache: "no-store",
    });
    let razorpayPayment = await razorpayPaymentResponse.json();
    if (razorpayPaymentResponse.ok &&
        razorpayPayment.order_id === order_id &&
        Number(razorpayPayment.amount) === 1900 &&
        razorpayPayment.currency === "INR" &&
        razorpayPayment.status === "authorized") {
      const captureResponse = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(payment_id) + "/capture", {
        method: "POST",
        headers: { "Authorization": razorpayAuth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1900, currency: "INR" }),
        cache: "no-store",
      });
      razorpayPayment = await captureResponse.json();
    }
    if (!razorpayPaymentResponse.ok ||
        razorpayPayment.order_id !== order_id ||
        Number(razorpayPayment.amount) !== 1900 ||
        razorpayPayment.currency !== "INR" ||
        razorpayPayment.status !== "captured") {
      return NextResponse.json({ error: "Payment is not captured yet. If money was deducted, please wait and contact support." }, { status: 402 });
    }

    if (payment.status !== "paid") {
      const { error: updateError } = await db.from("student_device_payments").update({
        status: "paid",
        razorpay_payment_id: payment_id,
        payment_signature: signature,
        paid_at: new Date().toISOString(),
      }).eq("id", payment.id).eq("status", "created");
      if (updateError) throw updateError;
    }

    const { data: result, error: claimError } = await db.rpc("claim_student_device_v2", {
      p_user_id: user.id,
      p_device_id: device_id,
    });
    if (claimError) throw claimError;
    if (result?.allowed !== true) {
      return NextResponse.json({ error: "Payment verified, but device registration could not finish. Please contact support with your payment ID." }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, message: "Payment verified and this device is registered." }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("mu_device_id", device_id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("DEVICE_PAYMENT_VERIFY_ERROR", error);
    return NextResponse.json({ error: "Unable to verify payment. Please contact support if money was deducted." }, { status: 500 });
  }
}
