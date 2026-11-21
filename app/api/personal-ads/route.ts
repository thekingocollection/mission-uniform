import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const placements = new Set(["home_hero", "article_inline", "study_material_end", "result_below", "footer"]);
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get("placement") || "";
  if (!placements.has(placement)) return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ campaign: null });
  const supabase = createClient(url, key);
  const now = new Date().toISOString();
  const { data } = await supabase.from("personal_ad_campaigns")
    .select("id,title,description,image_url,destination_url,button_text")
    .eq("placement", placement).eq("status", "active")
    .lte("starts_at", now).gte("ends_at", now)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ campaign: data || null }, { headers: { "Cache-Control": "no-store" } });
}
