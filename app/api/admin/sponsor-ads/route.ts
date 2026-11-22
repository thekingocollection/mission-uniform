import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function getAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("role,is_blocked")
    .eq("id", data.user.id)
    .maybeSingle();

  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

function isHttpUrl(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

export async function GET(req: NextRequest) {
  try {
    if (!(await getAdmin(req))) {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const db = getServiceSupabase();
    const { data, error } = await db
      .from("sponsor_ads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(
      { ads: data || [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Could not load banners." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdmin(req);
    if (!user) {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const targetUrl = String(body.target_url || "").trim();
    const imageUrl = String(body.image_url || "").trim() || null;

    if (!title || title.length > 100 || !isHttpUrl(targetUrl)) {
      return NextResponse.json(
        { error: "Title and a valid http(s) destination URL are required." },
        { status: 400 }
      );
    }
    if (imageUrl && !isHttpUrl(imageUrl)) {
      return NextResponse.json(
        { error: "Image URL must start with http:// or https://." },
        { status: 400 }
      );
    }

    const allowedPlacements = ["global_top", "dashboard_top", "syllabus_top", "below_content"];
    const placement = allowedPlacements.includes(body.placement) ? body.placement : "global_top";
    const payload = {
      title,
      description: String(body.description || "").trim().slice(0, 220) || null,
      image_url: imageUrl,
      target_url: targetUrl,
      placement,
      is_active: body.is_active === true,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      priority: Math.max(-100, Math.min(100, Number(body.priority) || 0)),
      updated_at: new Date().toISOString(),
    };

    const db = getServiceSupabase();
    const result = body.id
      ? await db.from("sponsor_ads").update(payload).eq("id", body.id).select().single()
      : await db.from("sponsor_ads").insert({ ...payload, created_by: user.id }).select().single();

    if (result.error) throw result.error;
    return NextResponse.json({ ad: result.data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Could not save banner." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdmin(req))) {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Banner ID required." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { error } = await db.from("sponsor_ads").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Could not delete banner." },
      { status: 500 }
    );
  }
}
