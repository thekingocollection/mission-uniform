import { NextRequest, NextResponse } from "next/server";
import { dispatchDueNotificationCampaigns } from "@/lib/notification-dispatch";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== "Bearer " + secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try { return NextResponse.json({ success: true, results: await dispatchDueNotificationCampaigns(20) }); }
  catch (e: any) { return NextResponse.json({ error: e.message || "Campaign scheduler failed." }, { status: 500 }); }
}
