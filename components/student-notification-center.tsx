"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Notice = { id: string; title: string; body: string; target_url: string; created_at: string; read_at: string | null; clicked_at: string | null; push_status: string };
function decodeKey(value: string) { const padded = value + "=".repeat((4 - value.length % 4) % 4); const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, c => c.charCodeAt(0)); }

export default function StudentNotificationCenter() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pushState, setPushState] = useState("checking");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const token = useCallback(async () => {
    const { data } = await sb!.auth.getSession();
    if (!data.session) throw new Error("Please log in again to view your notifications.");
    return data.session.access_token;
  }, [sb]);

  const load = useCallback(async () => {
    if (!sb) { setError("Student session is unavailable."); setLoading(false); return; }
    try {
      const access = await token();
      const response = await fetch("/api/student/notifications", { headers: { Authorization: "Bearer " + access }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load notifications.");
      setRows(result.notifications || []);
      setError("");
      const params = new URLSearchParams(window.location.search);
      const opened = params.get("openNotification");
      if (opened) {
        await fetch("/api/student/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify({ id: opened, action: "click" }) });
        window.history.replaceState({}, "", window.location.pathname);
        setRows((result.notifications || []).map((n: Notice) => n.id === opened ? { ...n, read_at: new Date().toISOString(), clicked_at: new Date().toISOString() } : n));
        const redirectTarget = params.get("target");
        if (redirectTarget && redirectTarget.startsWith("/") && !redirectTarget.startsWith("//") && redirectTarget !== "/notifications") window.location.replace(redirectTarget);
      }
    } catch (e: any) { setError(e.message || "Could not load notifications."); }
    finally { setLoading(false); }
  }, [sb, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setPushState("unsupported"); return; }
    navigator.serviceWorker.getRegistration("/").then(reg => {
      if (!reg) { setPushState("off"); return; }
      reg.pushManager.getSubscription().then(sub => setPushState(sub ? "on" : "off"));
    }).catch(() => setPushState("off"));
  }, []);

  async function subscribePush() {
    setBusy(true); setError("");
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push service is not configured yet. Please contact the administrator.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser does not support Web Push.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Please allow notifications in your browser settings.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) as BufferSource });
      const access = await token();
      const response = await fetch("/api/student/push-subscription", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify(subscription.toJSON()) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not enable push notifications.");
      setPushState("on");
    } catch (e: any) { setError(e.message || "Could not enable notifications."); }
    finally { setBusy(false); }
  }

  async function unsubscribePush() {
    setBusy(true); setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const access = await token();
        await fetch("/api/student/push-subscription", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setPushState("off");
    } catch (e: any) { setError(e.message || "Could not disable push notifications."); }
    finally { setBusy(false); }
  }

  async function mark(id: string, action: "read" | "click") {
    try {
      const access = await token();
      const response = await fetch("/api/student/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + access }, body: JSON.stringify({ id, action }) });
      if (!response.ok) throw new Error("Could not update notification.");
      const stamp = new Date().toISOString();
      setRows(old => old.map(n => n.id === id ? { ...n, read_at: stamp, clicked_at: action === "click" ? stamp : n.clicked_at } : n));
    } catch (e: any) { setError(e.message); }
  }

  const unread = rows.filter(n => !n.read_at).length;
  const visible = rows.filter(n => filter === "all" || !n.read_at);
  return <main className="content-wrap mu-notifications-page">
    <section className="panel">
      <div className="mu-notification-hero"><div><span className="eyebrow">MISSION UNIFORM OP · STUDENT UPDATES</span><h1>Your Notification Centre</h1><p>Daily challenges, exam updates and personal preparation reminders — all in one place.</p></div><div className="mu-notification-unread"><b>{unread}</b><span>UNREAD</span></div></div>
      <div className="mu-push-settings"><div><b>🔔 Enable browser notifications</b><small>{pushState === "on" ? "Push notifications are enabled on this device." : pushState === "unsupported" ? "This browser does not support Web Push." : "Get important study reminders even when the website is not open."}</small></div>{pushState === "on" ? <button className="btn secondary" disabled={busy} onClick={()=>void unsubscribePush()}>Turn Off</button> : <button className="btn primary" disabled={busy || pushState === "unsupported"} onClick={()=>void subscribePush()}>{busy ? "Please wait…" : "Enable Notifications"}</button>}</div>
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="mu-notice-toolbar"><div className="mu-notice-filters"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All updates</button><button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>Unread ({unread})</button></div><button className="btn secondary" onClick={()=>void load()} disabled={loading}>↻ Refresh</button></div>
      {loading ? <p>Loading your updates…</p> : visible.length === 0 ? <div className="mu-notice-empty"><span>✓</span><h2>{filter==="unread"?"You are all caught up!":"No notifications yet"}</h2><p>New preparation updates and challenges will appear here.</p><Link href="/dashboard">Back to Dashboard</Link></div> :
        <div className="mu-notice-list">{visible.map(n=><article key={n.id} className={"mu-notice-card "+(n.read_at?"is-read":"is-unread")}><div className="mu-notice-card-top"><span className="mu-notice-status">{n.read_at?"READ":"NEW"}</span><time>{new Date(n.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</time></div><h2>{n.title}</h2><p>{n.body}</p><div className="mu-notice-item-actions">{!n.read_at&&<button className="mu-notice-mark" onClick={()=>void mark(n.id,"read")}>Mark as read</button>}<Link href={n.target_url || "/notifications"} onClick={e=>{e.preventDefault();void mark(n.id,"click").then(()=>window.location.assign(n.target_url || "/notifications"));}}>Open update →</Link></div></article>)}</div>
      }
    </section>
  </main>;
}
