import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
    const body = await request.json();
    const deviceId = String(body?.device_id || "");
    if (!accessToken || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
      return NextResponse.json({ error: "Device verification failed. Please log in again." }, { status: 400 });
    }
    const db = getServiceSupabase();
    const { data, error } = await db.auth.getUser(accessToken);
    if (error || !data.user) return NextResponse.json({ error: "Your login session expired. Please log in again." }, { status: 401 });
    const { data: allowed, error: bindError } = await db.rpc("claim_student_device", {
      p_user_id: data.user.id,
      p_device_id: deviceId
    });
    if (bindError) {
      console.error("DEVICE_BIND_ERROR", bindError);
      return NextResponse.json({ error: "Secure device binding is not ready. Please contact support." }, { status: 503 });
    }
    if (allowed !== true) {
      return NextResponse.json({ error: "This student account is already registered on another device. Only the first registered device can use this account. Contact Admin if you changed or lost your device." }, { status: 409 });
    }
    const response = NextResponse.json({ success: true, message: "This device is securely registered." }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("mu_device_id", deviceId, {
      httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: 60 * 60 * 24 * 365
    });
    return response;
  } catch (error) {
    console.error("DEVICE_CLAIM_ERROR", error);
    return NextResponse.json({ error: "Unable to verify this device. Please try again." }, { status: 500 });
  }
}
