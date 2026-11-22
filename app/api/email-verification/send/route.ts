import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Please login first." }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resend = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!url || !anon || !service || !resend || !from) {
      return NextResponse.json({ error: "Email verification is not configured yet. Please contact support." }, { status: 503 });
    }
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user?.email) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from("profiles").select("email_verified").eq("id", auth.user.id).maybeSingle();
    if (profile?.email_verified) return NextResponse.json({ message: "Your email is already verified." });
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const { error: insertError } = await admin.from("email_verification_tokens").insert({
      user_id: auth.user.id, token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (insertError) return NextResponse.json({ error: "Could not create verification link. Please try again." }, { status: 500 });
    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const verifyUrl = origin + "/api/email-verification/verify?token=" + rawToken;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resend, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [auth.user.email], subject: "Verify your MISSION UNIFORM OP email",
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#172b3a"><h2>MISSION UNIFORM OP</h2><p>Your student account is ready. Confirm that this email belongs to you by clicking below.</p><p><a href="${verifyUrl}" style="display:inline-block;padding:13px 22px;background:#173b50;color:#fff;text-decoration:none;border-radius:8px">Verify Email</a></p><p>This link expires in 24 hours. You can continue studying and taking mock tests even if you verify later.</p><p>If you did not create this account, ignore this email.</p></div>`
      })
    });
    if (!response.ok) {
      await admin.from("email_verification_tokens").delete().eq("token_hash", tokenHash);
      return NextResponse.json({ error: "Email could not be sent. Please try again later." }, { status: 502 });
    }
    return NextResponse.json({ message: "Verification link sent. Please check your inbox and spam folder." });
  } catch {
    return NextResponse.json({ error: "Unable to send verification email right now." }, { status: 500 });
  }
}
