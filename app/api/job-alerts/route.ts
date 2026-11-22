import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const db = getServiceSupabase();
    const { data, error } = await db
      .from("job_alerts")
      .select("id,title,organization,description,official_url,last_date")
      .eq("published", true)
      .order("last_date", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json(
      { jobs: data || [] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("JOB_ALERTS_LIST_ERROR", error);
    return NextResponse.json(
      { error: error.message || "Unable to load job alerts." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
