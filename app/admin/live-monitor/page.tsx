"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type LiveStudent = { user_id:string; student_code:string; name:string; email:string; phone:string; last_seen_at:string; current_path:string; is_taking_test:boolean; test_title:string; test_started_at:string|null };
type MonitorData = { stats:Record<string,number>; online_students:LiveStudent[]; recent_activity:any[]; refreshed_at:string };

export default function LiveMonitorPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [data,setData] = useState<MonitorData|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [updated,setUpdated] = useState("");
  const load = useCallback(async () => {
    if (!sb) { setError("Supabase configuration is missing."); setLoading(false); return; }
    try {
      const { data:{session} } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/admin/live-monitor",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live monitor unavailable.");
      setData(result); setUpdated(result.refreshed_at || new Date().toISOString()); setError("");
    } catch(e:any) { setError(e.message || "Could not refresh live monitor."); }
    finally { setLoading(false); }
  },[sb]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),10000);return()=>window.clearInterval(timer);},[load]);
  const stats=data?.stats||{};
  const cards=[
    ["Online Now",stats.online_now??0,"Students active in last 75 seconds","online"],
    ["Taking Test Now",stats.taking_test_now??0,"Live attempts in progress","test"],
    ["Logged In Today",stats.logged_in_today??0,"Unique student accounts","login"],
    ["Offline Now",stats.offline_now??0,"Registered students not active now","offline"],
    ["Tests Started Today",stats.tests_started_today??0,"All attempts started today","started"],
    ["Tests Submitted Today",stats.tests_submitted_today??0,"Successfully submitted attempts","submitted"],
    ["In-progress Attempts Today",stats.attempts_in_progress_today??0,"Not yet submitted","progress"],
    ["Total Students",stats.total_students??0,"Registered student accounts","total"]
  ];
  return <main className="mu-live-monitor">
    <div className="admin-page-heading"><div><span className="admin-kicker">REAL-TIME STUDENT INTELLIGENCE</span><h1>Live Command Center</h1><p>Student presence, live exam activity and daily engagement monitoring.</p></div><button className="admin-action" onClick={()=>void load()} disabled={loading}>↻ Refresh Now</button></div>
    <div className="mu-live-status"><span><i/> LIVE MONITORING</span><small>Auto refresh every 10 seconds · Online means heartbeat within 75 seconds</small><small>{updated? "Last updated: "+new Date(updated).toLocaleTimeString("en-IN"):"Waiting for data…"}</small></div>
    {error&&<div className="admin-inline-message" role="alert">{error}</div>}
    <section className="mu-live-stat-grid">{cards.map(([title,value,desc,key])=><article className={"mu-live-stat "+key} key={String(key)}><span>{title}</span><b>{loading?"—":Number(value).toLocaleString("en-IN")}</b><small>{desc}</small></article>)}</section>
    <section className="admin-panel mu-live-panel"><div className="admin-panel-title"><div><span className="admin-kicker">ACTIVE SESSIONS</span><h2>Students Online Right Now</h2><p className="admin-muted">Students are sorted with active test takers first.</p></div><span className="mu-live-count">{data?.online_students.length||0} ONLINE</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Activity</th><th>Test / Page</th><th>Last Seen</th></tr></thead><tbody>{(data?.online_students||[]).map(s=><tr key={s.user_id}><td><b>{s.name}</b><small style={{display:"block"}}>{s.student_code||s.email||s.phone||"Student"}</small></td><td><span className={"mu-live-pill "+(s.is_taking_test?"exam":"online")}><i/>{s.is_taking_test?"Taking Test":"Online"}</span></td><td>{s.is_taking_test?<b>{s.test_title}</b>:<span>{s.current_path}</span>}</td><td>{new Date(s.last_seen_at).toLocaleTimeString("en-IN")}</td></tr>)}{!data?.online_students?.length&&<tr><td colSpan={4}>{loading?"Loading live sessions…":"No students online at the moment."}</td></tr>}</tbody></table></div>
    </section>
    <section className="admin-panel mu-live-panel"><div className="admin-panel-title"><div><span className="admin-kicker">TODAY'S EXAM ACTIVITY</span><h2>Recent Test Starts</h2></div></div>
      <div className="mu-live-activity">{(data?.recent_activity||[]).map((a:any)=><article key={a.id}><span className={a.submitted?"done":"running"}>{a.submitted?"✓":"◷"}</span><div><b>{a.student}</b><p>{a.student_code} · {a.test}</p><small>{new Date(a.started_at).toLocaleString("en-IN")}</small></div><em>{a.submitted?"Submitted":"In progress"}</em></article>)}{!data?.recent_activity?.length&&<p className="admin-muted">No test activity recorded today.</p>}</div>
    </section>
    <p className="admin-muted mu-live-footnote">Presence is refreshed while a student has the site open and visible. A student may be marked offline after 75 seconds without a heartbeat. Browser closing, network loss and mobile background restrictions can delay status changes.</p>
  </main>;
}
