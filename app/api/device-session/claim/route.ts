import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = await request.json();
    const deviceId = String(body?.device_id || "");
    if (!accessToken || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
      return NextResponse.json({ error: "Device verification failed. Please log in again." }, { status: 400 });
    }
    const db = getServiceSupabase();
    const { data, error } = await db.auth.getUser(accessToken);
    if (error || !data.user) return NextResponse.json({ error: "Your login session expired. Please log in again." }, { status: 401 });

    const { data: profile, error: profileError } = await db.from("profiles")\n      .select("role,is_blocked")\n      .eq("id", data.user.id)\n      .maybeSingle();\n    if (profileError) {\n      console.error("DEVICE_PROFILE_VERIFY_ERROR", profileError);\n      return NextResponse.json({ error: "Could not verify your student account. Please retry." }, { status: 503 });\n    }\n    if (!profile || profile.is_blocked || profile.role === "super_admin" || profile.role === "staff_admin") {\n      return NextResponse.json({ error: "This account is not authorized for student device registration." }, { status: 403 });\n    }\n\n    const { data: claimResult, error: bindError } = await db.rpc("claim_student_device_account_limit", {
      p_user_id: data.user.id,
      p_device_id: deviceId,
    });
    if (bindError) {
      console.error("DEVICE_BIND_ERROR", bindError);
      return NextResponse.json({ error: "Device registration service is not ready. Please contact support." }, { status: 503 });
    }
    if (claimResult?.account_limit_reached === true) {
      return NextResponse.json({
        error: "This device has already been used to create two student accounts. You cannot create another account on this device.",
        account_limit_reached: true,
        max_accounts: 2,
      }, { status: 403 });
    }
    if (claimResult?.payment_required === true) {
      return NextResponse.json({
        payment_required: true,
        price_paise: 1900,
        error: "Your two free device slots are already used. Pay ₹19 once to register this additional device.",
      }, { status: 402 });
    }
    if (claimResult?.allowed !== true) {
      return NextResponse.json({ error: "This device could not be registered. Please contact Admin." }, { status: 409 });
    }

    const response = NextResponse.json({
      success: true,
      message: "This device is securely registered.",
      device_type: claimResult.free_device ? "free" : claimResult.paid_device ? "paid" : "registered",
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("mu_device_id", deviceId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("DEVICE_CLAIM_ERROR", error);
    return NextResponse.json({ error: "Unable to verify this device. Please try again." }, { status: 500 });
  }
}
