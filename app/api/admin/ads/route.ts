import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const allowed = new Set(["home_hero", "article_inline", "study_material_end", "result_below", "footer"]);
async function adminClient(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "super_admin", "finance_manager"].includes(profile.role)) return null;
  return client;
}

export async function GET(req: NextRequest) {
  const client = await adminClient(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await client.from("ad_placement_settings").select("*").order("placement");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const client = await adminClient(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !allowed.has(body.placement) || typeof body.enabled !== "boolean" ||
      (body.slot_id !== null && body.slot_id !== undefined && !/^\d{6,20}$/.test(String(body.slot_id)))) {
    return NextResponse.json({ error: "Invalid placement settings" }, { status: 400 });
  }
  const { data, error } = await client.from("ad_placement_settings").update({
    enabled: body.enabled, slot_id: body.slot_id || null, updated_at: new Date().toISOString()
  }).eq("placement", body.placement).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const client = await adminClient(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.global_enabled !== "boolean" || !Number.isInteger(body.max_ads_per_page) ||
      body.max_ads_per_page < 0 || body.max_ads_per_page > 5) {
    return NextResponse.json({ error: "Invalid global ad settings" }, { status: 400 });
  }
  const { error } = await client.from("ad_placement_settings").update({
    global_enabled: body.global_enabled, max_ads_per_page: body.max_ads_per_page, updated_at: new Date().toISOString()
  }).neq("placement", "");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
