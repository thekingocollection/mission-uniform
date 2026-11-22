import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function requireSuperAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

export async function GET(req: NextRequest) {
  try {
    const placement = req.nextUrl.searchParams.get("placement") || "global_top";
    const db = getServiceSupabase();
    const now = new Date().toISOString();
    const { data, error } = await db.from("sponsor_ads").select("id,title,description,image_url,target_url,placement")
      .eq("is_active", true).eq("placement", placement)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ad: data?.[0] || null }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } });
  } catch (e: any) { return NextResponse.json({ ad: null, error: e.message }, { status: 200 }); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await req.json();
    const title = String(body.title || "").trim();
    const target_url = String(body.target_url || "").trim();
    if (!title || title.length > 100 || !target_url || !/^https?:\/\//i.test(target_url)) return NextResponse.json({ error: "Title and a valid http(s) destination URL are required." }, { status: 400 });
    const placement = ["global_top","dashboard_top","syllabus_top","below_content"].includes(body.placement) ? body.placement : "global_top";
    const payload = {
      title, description: String(body.description || "").trim().slice(0,220) || null,
      image_url: String(body.image_url || "").trim() || null, target_url, placement,
      is_active: body.is_active === true, starts_at: body.starts_at || null, ends_at: body.ends_at || null,
      priority: Math.max(-100, Math.min(100, Number(body.priority) || 0)), created_by: admin.id, updated_at: new Date().toISOString()
    };
    if (payload.image_url && !/^https?:\/\//i.test(payload.image_url)) return NextResponse.json({ error: "Image URL must start with http:// or https://." }, { status: 400 });
    const db = getServiceSupabase();
    const { data, error } = body.id
      ? await db.from("sponsor_ads").update(payload).eq("id", body.id).select().single()
      : await db.from("sponsor_ads").insert(payload).select().single();
    if (error) throw error;
    return NextResponse.json({ ad: data });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not save sponsor banner." }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Banner ID required." }, { status: 400 });
    const db = getServiceSupabase();
    const { error } = await db.from("sponsor_ads").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not delete banner." }, { status: 500 }); }
}
