"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Notification = { id: string; title: string; body: string | null; created_at: string };
export default function StudentNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) { if (active) { setError("Database connection is not configured."); setLoading(false); } return; }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { if (active) { setError("Please log in to view notifications."); setLoading(false); } return; }
      const [{ data, error: listError }, { data: reads }] = await Promise.all([
        sb.from("notifications").select("id,title,body,created_at").eq("published", true).order("created_at", { ascending: false }),
        sb.from("notification_reads").select("notification_id").eq("user_id", user.id),
      ]);
      if (!active) return;
      if (listError) setError(listError.message);
      else setItems(data ?? []);
      setReadIds((reads ?? []).map((row: { notification_id: string }) => row.notification_id));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  async function markRead(id: string) {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { error: saveError } = await sb.from("notification_reads").upsert(
      { notification_id: id, user_id: user.id, read_at: new Date().toISOString() },
      { onConflict: "notification_id,user_id" }
    );
    if (saveError) { setError(saveError.message); return; }
    setReadIds(current => current.includes(id) ? current : [...current, id]);
  }

  const unread = items.filter(item => !readIds.includes(item.id)).length;
  return <div className="mu-notifications-page">
    <section className="mu-notifications-hero">
      <span className="mu-kicker">STUDENT UPDATES</span>
      <h1>Notifications</h1>
      <p>Important announcements and updates from MISSION UNIFORM OP.</p>
      <span className="mu-notifications-summary">{unread} unread · {items.length} total</span>
    </section>
    {error && <div className="mu-notifications-error" role="alert">{error}</div>}
    {loading ? <div className="mu-notifications-empty">Loading notifications…</div> :
      items.length === 0 ? <div className="mu-notifications-empty"><span>♧</span><h2>You’re all caught up</h2><p>New announcements from the admin will appear here.</p></div> :
      <section className="mu-notifications-list" aria-label="Student notifications">
        {items.map(item => {
          const isRead = readIds.includes(item.id);
          return <article className={isRead ? "mu-notification-card read" : "mu-notification-card unread"} key={item.id}>
            <div className="mu-notification-icon">♧</div>
            <div className="mu-notification-content">
              <div className="mu-notification-meta"><span>{isRead ? "READ" : "NEW"}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></div>
              <h2>{item.title}</h2>
              {item.body && <p>{item.body}</p>}
              {!isRead && <button type="button" onClick={() => markRead(item.id)}>Mark as read</button>}
            </div>
          </article>;
        })}
      </section>
    }
  </div>;
}
