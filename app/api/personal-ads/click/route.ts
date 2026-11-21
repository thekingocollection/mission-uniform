import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const placements = new Set(["home_hero", "article_inline", "study_material_end", "result_below", "footer"]);
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.campaign_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.campaign_id) || !placements.has(body.placement)) {
    return NextResponse.json({ error: "Invalid click event" }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false }, { status: 503 });
  const supabase = createClient(url, key);
  const { error } = await supabase.from("personal_ad_clicks").insert({
    campaign_id: body.campaign_id, placement: body.placement
  });
  if (error) return NextResponse.json({ error: "Could not record click" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
