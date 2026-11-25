import webpush from "web-push";
import { getServiceSupabase } from "@/lib/server-supabase";
import { sendFcmNotifications } from "@/lib/firebase-admin";

type Campaign = {
  id: string; title: string; body: string; target_type: string; target_days: number;
  target_url: string; inapp_enabled: boolean; push_enabled: boolean;
};

function configurePush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@mission-uniform.in";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function getTargetStudents(db: ReturnType<typeof getServiceSupabase>, campaign: Campaign) {
  const { data: profiles, error } = await db.from("profiles")
    .select("id,created_at").eq("role", "student").eq("is_blocked", false);
  if (error) throw error;
  const students = profiles || [];
  const now = Date.now();
  if (campaign.target_type === "new_7d") {
    const cutoff = now - 7 * 86400000;
    return students.filter((s: any) => new Date(s.created_at).getTime() >= cutoff).map((s: any) => s.id);
  }
  if (campaign.target_type === "active_7d" || campaign.target_type === "inactive_2d") {
    const days = campaign.target_type === "active_7d" ? 7 : campaign.target_days;
    const cutoff = new Date(now - days * 86400000).toISOString();
    const { data: presence, error: presenceError } = await db.from("student_live_presence")
      .select("user_id,last_seen_at").gte("last_seen_at", cutoff);
    if (presenceError && !String(presenceError.message || "").toLowerCase().includes("does not exist")) throw presenceError;
    const active = new Set((presence || []).map((p: any) => p.user_id));
    return students.filter((s: any) => campaign.target_type === "active_7d" ? active.has(s.id) : !active.has(s.id)).map((s: any) => s.id);
  }
  return students.map((s: any) => s.id);
}

export async function dispatchDueNotificationCampaigns(limit = 10) {
  const db = getServiceSupabase();
  const now = new Date().toISOString();
  const { data: due, error } = await db.from("notification_campaigns")
    .select("id,title,body,target_type,target_days,target_url,inapp_enabled,push_enabled")
    .eq("status", "scheduled").lte("schedule_at", now)
    .order("schedule_at", { ascending: true }).limit(limit);
  if (error) throw error;
  const results: any[] = [];
  for (const campaign of (due || []) as Campaign[]) {
    const { data: claimed, error: claimError } = await db.from("notification_campaigns")
      .update({ status: "sending", error_message: null }).eq("id", campaign.id).eq("status", "scheduled").select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;
    try {
      const userIds = await getTargetStudents(db, campaign);
      let inappCount = 0, pushSent = 0, pushFailed = 0;
      if (userIds.length) {
        const [subscriptionResult, fcmResult] = campaign.push_enabled
          ? await Promise.all([
              db.from("student_push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key").in("user_id", userIds),
              db.from("student_fcm_tokens").select("token,user_id").in("user_id", userIds)
            ])
          : [{ data: [], error: null }, { data: [], error: null }];
        if (subscriptionResult.error) throw subscriptionResult.error;
        if (fcmResult.error) throw fcmResult.error;
        const subsByUser = new Map<string, any[]>();
        for (const sub of subscriptionResult.data || []) {
          const list = subsByUser.get(sub.user_id) || [];
          list.push(sub); subsByUser.set(sub.user_id, list);
        }
        const tokensByUser = new Map<string, string[]>();
        for (const item of fcmResult.data || []) {
          const list = tokensByUser.get(item.user_id) || [];
          list.push(item.token); tokensByUser.set(item.user_id, list);
        }
        const rows = userIds.map(userId => ({
          campaign_id: campaign.id, user_id: userId, title: campaign.title, body: campaign.body,
          target_url: campaign.target_url || "/notifications", inapp_visible: campaign.inapp_enabled,
          push_status: campaign.push_enabled
            ? ((subsByUser.get(userId)?.length || tokensByUser.get(userId)?.length) ? "pending" : "no_subscription")
            : "not_requested"
        }));
        for (let offset = 0; offset < rows.length; offset += 500) {
          const batch = rows.slice(offset, offset + 500);
          const { data: inserted, error: insertError } = await db.from("student_notifications").insert(batch).select("id,user_id,push_status");
          if (insertError) throw insertError;
          inappCount += campaign.inapp_enabled ? (inserted || []).length : 0;
          if (campaign.push_enabled && inserted?.length) {
            const configured = configurePush();
            for (const notice of inserted as any[]) {
              const subscriptions = subsByUser.get(notice.user_id) || [];
              const tokens = tokensByUser.get(notice.user_id) || [];
              let delivered = false;
              const errors: string[] = [];

              if (tokens.length) {
                try {
                  const result = await sendFcmNotifications({
                    tokens, title: campaign.title, body: campaign.body,
                    url: campaign.target_url || "/notifications"
                  });
                  delivered = result.successCount > 0;
                  if (result.invalidTokens.length) {
                    await db.from("student_fcm_tokens").delete().in("token", result.invalidTokens);
                  }
                  if (result.failureCount) errors.push(result.failureCount + " FCM delivery failure(s)");
                } catch (fcmError: any) {
                  errors.push("FCM: " + String(fcmError?.message || "delivery failed").slice(0, 250));
                }
              }

              if (subscriptions.length && configured) {
                for (const sub of subscriptions) {
                  try {
                    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, JSON.stringify({
                      title: campaign.title, body: campaign.body, url: campaign.target_url || "/notifications", notificationId: notice.id
                    }), { TTL: 60 * 60 * 24 });
                    delivered = true;
                  } catch (pushError: any) {
                    if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
                      await db.from("student_push_subscriptions").delete().eq("id", sub.id);
                    }
                    errors.push("Web Push delivery failed");
                  }
                }
              } else if (subscriptions.length && !configured) {
                errors.push("VAPID keys are not configured");
              }

              if (delivered) {
                pushSent++;
                await db.from("student_notifications").update({ push_status: "sent", push_sent_at: new Date().toISOString(), push_error: errors.length ? errors.join("; ").slice(0, 500) : null }).eq("id", notice.id);
              } else if (tokens.length || subscriptions.length) {
                pushFailed++;
                await db.from("student_notifications").update({ push_status: "failed", push_error: errors.join("; ").slice(0, 500) || "Push delivery failed." }).eq("id", notice.id);
              }
            }
          }
        }
      }
      const { error: finishError } = await db.from("notification_campaigns").update({
        status: "sent", target_count: userIds.length, inapp_count: inappCount,
        push_sent_count: pushSent, push_failed_count: pushFailed, sent_at: new Date().toISOString()
      }).eq("id", campaign.id);
      if (finishError) throw finishError;
      results.push({ id: campaign.id, status: "sent", target_count: userIds.length, inapp_count: inappCount, push_sent_count: pushSent, push_failed_count: pushFailed });
    } catch (e: any) {
      await db.from("notification_campaigns").update({ status: "failed", error_message: String(e?.message || "Campaign delivery failed").slice(0, 1000) }).eq("id", campaign.id);
      results.push({ id: campaign.id, status: "failed", error: e?.message || "Delivery failed" });
    }
  }
  return results;
}
