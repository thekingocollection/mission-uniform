import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("token") || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const destination = new URL("/dashboard", process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin);
  if (!/^[a-f0-9]{64}$/.test(raw) || !url || !service) {
    destination.searchParams.set("email_verification", "invalid");
    return NextResponse.redirect(destination);
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const { data: record } = await admin.from("email_verification_tokens")
    .select("id,user_id,expires_at,used_at").eq("token_hash", tokenHash).maybeSingle();
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now()) {
    destination.searchParams.set("email_verification", "invalid");
    return NextResponse.redirect(destination);
  }
  const { error } = await admin.from("profiles").update({ email_verified: true }).eq("id", record.user_id);
  if (error) {
    destination.searchParams.set("email_verification", "error");
    return NextResponse.redirect(destination);
  }
  await admin.from("email_verification_tokens").update({ used_at: new Date().toISOString() }).eq("id", record.id);
  destination.searchParams.set("email_verification", "success");
  return NextResponse.redirect(destination);
}
