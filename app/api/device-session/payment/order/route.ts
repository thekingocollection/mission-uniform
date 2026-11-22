import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const body = await request.json();
    const deviceId = String(body?.device_id || "");
    if (!UUID.test(deviceId)) return NextResponse.json({ error: "Invalid device. Please login again." }, { status: 400 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Online payment is not configured yet. Please contact Admin." }, { status: 503 });
    }

    const db = getServiceSupabase();
    const { data: existing } = await db.from("student_device_bindings")
      .select("device_id").eq("user_id", user.id).eq("device_id", deviceId).maybeSingle();
    if (existing) return NextResponse.json({ error: "This device is already registered." }, { status: 409 });

    const receipt = ("mu_device_" + user.id.replace(/-/g, "").slice(0, 12) + "_" + Date.now()).slice(0, 40);
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 1900,
        currency: "INR",
        receipt,
        notes: { user_id: user.id, device_id: deviceId, purpose: "MISSION_UNIFORM_EXTRA_DEVICE" },
      }),
      cache: "no-store",
    });
    const order = await razorpayResponse.json();
    if (!razorpayResponse.ok || !order.id) {
      console.error("DEVICE_RAZORPAY_ORDER_ERROR", order);
      return NextResponse.json({ error: "Could not create payment order. Please try again." }, { status: 502 });
    }

    const { error: insertError } = await db.from("student_device_payments").insert({
      user_id: user.id,
      device_id: deviceId,
      razorpay_order_id: order.id,
      amount_paise: 1900,
      currency: "INR",
      status: "created",
    });
    if (insertError) throw insertError;

    return NextResponse.json({
      key_id: keyId,
      order_id: order.id,
      amount: 1900,
      currency: "INR",
      name: "MISSION UNIFORM OP",
      description: "One-time additional device registration",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("DEVICE_PAYMENT_ORDER_ERROR", error);
    return NextResponse.json({ error: "Unable to start payment. Please try again." }, { status: 500 });
  }
}
