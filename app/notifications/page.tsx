"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Notice = { id:string; title:string; body:string|null; created_at:string|null };
const READ_KEY = "muop-read-notifications-v1";

export default function NotificationsPage() {
  const [rows,setRows] = useState<Notice[]>([]);
  const [readIds,setReadIds] = useState<string[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [filter,setFilter] = useState<"all"|"unread"|"read">("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Notifications are temporarily unavailable.");
      const { data, error: queryError } = await sb.from("notifications")
        .select("id,title,body,created_at")
        .eq("published",true)
        .order("created_at",{ascending:false})
        .limit(50);
      if (queryError) throw queryError;
      setRows((data || []) as Notice[]);
      try { setReadIds(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); } catch { setReadIds([]); }
    } catch (e:any) {
      setError(e?.message || "Could not load notifications.");
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{ void load(); },[load]);

  const unreadCount = rows.filter(n=>!readIds.includes(n.id)).length;
  const visible = useMemo(()=>rows.filter(n=>filter==="all" || (filter==="read" ? readIds.includes(n.id) : !readIds.includes(n.id))),[rows,readIds,filter]);

  function markRead(id:string) {
    setReadIds(old=>{
      const next=old.includes(id)?old:[...old,id];
      try { localStorage.setItem(READ_KEY,JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function markAllRead() {
    const next=rows.map(n=>n.id);
    setReadIds(old=>{
      const merged=Array.from(new Set([...old,...next]));
      try { localStorage.setItem(READ_KEY,JSON.stringify(merged)); } catch {}
      return merged;
    });
  }

  return (
    <main className="content-wrap mu-notifications-page">
      <section className="panel">
        <span className="eyebrow">MISSION UNIFORM OP · STUDENT UPDATES</span>
        <div className="mu-notice-header">
          <div><h1>Notifications</h1><p className="muted">Official announcements and important preparation updates.</p></div>
          <div className="mu-notice-count"><b>{unreadCount}</b><span>Unread</span></div>
        </div>
        <div className="mu-notice-toolbar">
          <div className="mu-notice-filters">
            {(["all","unread","read"] as const).map(x=><button key={x} type="button" className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x==="all"?"All":x==="unread"?"Unread":"Read"}</button>)}
          </div>
          <div className="mu-notice-actions">
            <button type="button" className="btn secondary" onClick={()=>void load()} disabled={loading}>Refresh</button>
            <button type="button" className="btn secondary" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button>
          </div>
        </div>
        {loading ? <p role="status">Loading notifications…</p> : error ? <div className="mu-notice-empty" role="alert"><p>{error}</p><button className="btn primary" onClick={()=>void load()}>Try again</button></div> : visible.length===0 ? <div className="mu-notice-empty"><span>✓</span><h2>{filter==="unread"?"You are all caught up!":"No notifications yet"}</h2><p>{filter==="unread"?"There are no unread announcements.":"New official announcements will appear here when published by the admin."}</p><Link href="/dashboard">Back to Dashboard</Link></div> :
          <div className="mu-notice-list">{visible.map(n=>{
            const read=readIds.includes(n.id);
            return <article key={n.id} className={`mu-notice-card ${read?"is-read":"is-unread"}`}>
              <div className="mu-notice-card-top"><span className="mu-notice-status">{read?"READ":"NEW"}</span><time>{n.created_at?new Date(n.created_at).toLocaleString():"Official update"}</time></div>
              <h2>{n.title}</h2>
              {n.body&&<p>{n.body}</p>}
              {!read&&<button type="button" className="mu-notice-mark" onClick={()=>markRead(n.id)}>Mark as read</button>}
            </article>;
          })}</div>
        }
      </section>
    </main>
  );
}
