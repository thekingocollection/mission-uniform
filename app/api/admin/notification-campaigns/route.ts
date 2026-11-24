import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { dispatchDueNotificationCampaigns } from "@/lib/notification-dispatch";

export const runtime = "nodejs";
async function requireNotificationAdmin(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked,permissions").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.is_blocked) return null;
  if (profile.role !== "super_admin" && !(profile.role === "staff_admin" && profile.permissions?.manage_notifications === true)) return null;
  return data.user;
}

export async function GET(req: NextRequest) {
  try {
    if (!await requireNotificationAdmin(req)) return NextResponse.json({ error: "Notification management permission required." }, { status: 403 });
    const db = getServiceSupabase();
    const { data: campaigns, error } = await db.from("notification_campaigns").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ids = (campaigns || []).map((c: any) => c.id);
    const { data: notices, error: noticeError } = ids.length
      ? await db.from("student_notifications").select("campaign_id,clicked_at,read_at,push_status").in("campaign_id", ids).limit(20000)
      : { data: [], error: null };
    if (noticeError) throw noticeError;
    const metrics = new Map<string, { clicks: number; reads: number; pushSent: number; pushFailed: number }>();
    for (const n of notices || []) {
      const m = metrics.get(n.campaign_id) || { clicks: 0, reads: 0, pushSent: 0, pushFailed: 0 };
      if (n.clicked_at) m.clicks++;
      if (n.read_at) m.reads++;
      if (n.push_status === "sent") m.pushSent++;
      if (n.push_status === "failed") m.pushFailed++;
      metrics.set(n.campaign_id, m);
    }
    return NextResponse.json({ campaigns: (campaigns || []).map((c: any) => ({ ...c, metrics: metrics.get(c.id) || { clicks: 0, reads: 0, pushSent: 0, pushFailed: 0 } })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load campaigns." }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireNotificationAdmin(req);
    if (!user) return NextResponse.json({ error: "Notification management permission required." }, { status: 403 });
    const body = await req.json().catch(() => null);
    const title = String(body?.title || "").trim().slice(0, 120);
    const message = String(body?.body || "").trim().slice(0, 1000);
    const targetType = String(body?.target_type || "all");
    const allowedTargets = ["all", "active_7d", "inactive_2d", "new_7d"];
    if (title.length < 3 || !message) return NextResponse.json({ error: "Enter a title and message." }, { status: 400 });
    if (!allowedTargets.includes(targetType)) return NextResponse.json({ error: "Invalid student audience." }, { status: 400 });
    if (body?.inapp_enabled !== true && body?.push_enabled !== true) return NextResponse.json({ error: "Select at least one delivery channel." }, { status: 400 });
    const rawUrl = String(body?.target_url || "/notifications").trim();
    if (!rawUrl.startsWith("/") || rawUrl.startsWith("//")) return NextResponse.json({ error: "Notification link must be a local path." }, { status: 400 });
    const scheduleDate = body?.send_now ? new Date() : new Date(body?.schedule_at || "");
    if (Number.isNaN(scheduleDate.getTime())) return NextResponse.json({ error: "Choose a valid schedule date and time." }, { status: 400 });
    const scheduleAt = scheduleDate.toISOString();
    const db = getServiceSupabase();
    const { data, error } = await db.from("notification_campaigns").insert({
      title, body: message, target_type: targetType, target_days: Math.min(365, Math.max(1, Number(body?.target_days) || 2)),
      target_url: rawUrl, inapp_enabled: body?.inapp_enabled === true, push_enabled: body?.push_enabled === true,
      schedule_at: scheduleAt, status: "scheduled", created_by: user.id
    }).select("*").single();
    if (error) throw error;
    let delivery: any[] = [];
    if (body?.send_now) delivery = await dispatchDueNotificationCampaigns(20);
    return NextResponse.json({ success: true, campaign: data, delivery }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not create campaign." }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!await requireNotificationAdmin(req)) return NextResponse.json({ error: "Notification management permission required." }, { status: 403 });
    const body = await req.json().catch(() => null);
    if (body?.action !== "process_due") return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    const results = await dispatchDueNotificationCampaigns(20);
    return NextResponse.json({ success: true, results });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not process scheduled campaigns." }, { status: 500 }); }
}
