import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const placements = ["home_hero", "article_inline", "study_material_end", "result_below", "footer"] as const;
const defaults = {
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED === "true",
  publisherId: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || null,
  maxAdsPerPage: Math.min(5, Math.max(0, Number(process.env.NEXT_PUBLIC_ADS_MAX_PER_PAGE || 3))),
  placements: Object.fromEntries(placements.map((p) => [p, {
    enabled: process.env[`NEXT_PUBLIC_AD_${p.toUpperCase()}_ENABLED`] !== "false",
    slot_id: process.env[`NEXT_PUBLIC_AD_${p.toUpperCase()}_SLOT`] || null,
  }])),
};

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json(defaults, { headers: { "Cache-Control": "no-store" } });
  try {
    const supabase = createClient(url, key);
    const { data } = await supabase.from("ad_placement_settings").select("placement,enabled,slot_id,max_ads_per_page,global_enabled");
    if (!data?.length) return NextResponse.json(defaults, { headers: { "Cache-Control": "no-store" } });
    const next = { ...defaults, placements: { ...defaults.placements } as Record<string, {enabled:boolean;slot_id:string|null}> };
    for (const row of data) {
      if (placements.includes(row.placement)) next.placements[row.placement] = { enabled: row.enabled, slot_id: row.slot_id };
      next.enabled = Boolean(row.global_enabled) && defaults.enabled;
      if (row.max_ads_per_page != null) next.maxAdsPerPage = Math.min(5, Math.max(0, row.max_ads_per_page));
    }
    return NextResponse.json(next, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(defaults, { headers: { "Cache-Control": "no-store" } });
  }
}
