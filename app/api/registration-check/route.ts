import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = String(body?.phone || "").replace(/\D/g, "").slice(-10);
    const email = String(body?.email || "").trim().toLowerCase();
    if (!/^[6-9]\d{9}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email and 10-digit mobile number." }, { status: 400 });
    }
    const db = getServiceSupabase();
    const [{ data: phoneMatch, error: phoneError }, { data: emailMatch, error: emailError }] = await Promise.all([
      db.from("profiles").select("id").eq("phone", phone).limit(1).maybeSingle(),
      db.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle()
    ]);
    if (phoneError) throw phoneError;
    if (emailError) throw emailError;
    if (phoneMatch) return NextResponse.json({ error: "This mobile number is already registered. Please login or use another number.", duplicate: "phone" }, { status: 409 });
    if (emailMatch) return NextResponse.json({ error: "This email is already registered. Please login or use another email.", duplicate: "email" }, { status: 409 });
    return NextResponse.json({ available: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("REGISTRATION_CHECK_ERROR", error);
    return NextResponse.json({ error: "Could not verify registration details. Please try again." }, { status: 500 });
  }
}
