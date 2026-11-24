"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type LiveStudent = { user_id:string; student_code:string; name:string; email:string; phone:string; last_seen_at:string; current_path:string; is_taking_test:boolean; test_title:string; test_started_at:string|null };
type MonitorData = { stats:Record<string,number>; online_students:LiveStudent[]; recent_activity:any[]; refreshed_at:string };

export default function LiveMonitorPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [data,setData] = useState<MonitorData|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [updated,setUpdated] = useState("");
  const [indiaNow,setIndiaNow] = useState(() => new Date());
  const [autoRefresh,setAutoRefresh] = useState(true);
  const inFlight = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setIndiaNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const indiaTime = (value: string | Date, withDate = false) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", ...(withDate ? { day: "2-digit", month: "short", year: "numeric" } : {}) });
  const load = useCallback(async () => {
    if (inFlight.current) return;
    if (!sb) { setError("Supabase configuration is missing."); setLoading(false); return; }
    inFlight.current = true;
    try {
      const { data:{session} } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in again.");
      const response = await fetch("/api/admin/live-monitor",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Live monitor unavailable.");
      setData(result); setUpdated(result.refreshed_at || new Date().toISOString()); setError("");
    } catch(e:any) { setError(e.message || "Could not refresh live monitor."); }
    finally { setLoading(false); inFlight.current = false; }
  },[sb]);
  useEffect(()=>{void load();if(!autoRefresh)return;const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},5000);return()=>window.clearInterval(timer);},[load,autoRefresh]);
  const stats=data?.stats||{};
  const cards=[
    ["Online Now",stats.online_now??0,"Students active in last 75 seconds","online"],
    ["Taking Test Now",stats.taking_test_now??0,"Live attempts in progress","test"],
    ["Active Students Today",stats.logged_in_today??0,"Currently online students seen today","login"],
    ["Offline Now",stats.offline_now??0,"Registered students not active now","offline"],
    ["Tests Started Today",stats.tests_started_today??0,"All attempts started today","started"],
    ["Tests Submitted Today",stats.tests_submitted_today??0,"Successfully submitted attempts","submitted"],
    ["Pending Submissions",stats.attempts_in_progress_today??0,"Tests started but not submitted today","progress"],
    ["Total Students",stats.total_students??0,"Registered student accounts","total"]
  ];
  return <main className="mu-live-monitor">
    <div className="admin-page-heading"><div><span className="admin-kicker">REAL-TIME STUDENT INTELLIGENCE</span><h1>Live Command Center</h1><p>Student presence, live exam activity and daily engagement monitoring.</p></div><div className="mu-live-clock"><div><span className="admin-kicker">INDIAN STANDARD TIME · IST</span><strong>{indiaNow.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</strong><small>{indiaNow.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</small></div><div className="mu-live-controls"><button className={"admin-action "+(autoRefresh?"active":"")} onClick={()=>setAutoRefresh(v=>!v)}>{autoRefresh?"● Auto-refresh ON":"○ Auto-refresh OFF"}</button><button className="admin-action" onClick={()=>void load()} disabled={loading}>↻ Refresh Now</button></div></div></div>
    <div className="mu-live-status"><span><i/> LIVE MONITORING</span><small>{autoRefresh?"Auto refresh every 5 seconds":"Auto refresh paused"} · Online means heartbeat within 75 seconds</small><small>{updated? "Last updated: "+indiaTime(updated):"Waiting for data…"}</small></div>
    {error&&<div className="admin-inline-message" role="alert">{error}</div>}
    <section className="mu-live-stat-grid">{cards.map(([title,value,desc,key])=><article className={"mu-live-stat "+key} key={String(key)}><span>{title}</span><b>{loading?"—":Number(value).toLocaleString("en-IN")}</b><small>{desc}</small></article>)}</section>
    <section className="admin-panel mu-live-panel"><div className="admin-panel-title"><div><span className="admin-kicker">ACTIVE SESSIONS</span><h2>Students Online Right Now</h2><p className="admin-muted">Students are sorted with active test takers first.</p></div><span className="mu-live-count">{data?.online_students.length||0} ONLINE</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Activity</th><th>Test / Page</th><th>Last Seen</th></tr></thead><tbody>{(data?.online_students||[]).map(s=><tr key={s.user_id}><td><b>{s.name}</b><small style={{display:"block"}}>{s.student_code||s.email||s.phone||"Student"}</small></td><td><span className={"mu-live-pill "+(s.is_taking_test?"exam":"online")}><i/>{s.is_taking_test?"Taking Test":"Online"}</span></td><td>{s.is_taking_test?<b>{s.test_title}</b>:<span>{s.current_path}</span>}</td><td>{indiaTime(s.last_seen_at)}</td></tr>)}{!data?.online_students?.length&&<tr><td colSpan={4}>{loading?"Loading live sessions…":"No students online at the moment."}</td></tr>}</tbody></table></div>
    </section>
    <section className="admin-panel mu-live-panel"><div className="admin-panel-title"><div><span className="admin-kicker">STUDENT-WISE PERFORMANCE · TODAY</span><h2>Who took how many tests?</h2><p className="admin-muted">Daily attempts, completed tests, pending submissions and average score for each student.</p></div><span className="mu-live-count">{data?.student_performance?.length||0} STUDENTS</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Tests Taken</th><th>Submitted</th><th>Pending</th><th>Average Score</th><th>Latest Score</th></tr></thead><tbody>{(data?.student_performance||[]).map((p:any)=><tr key={p.user_id}><td><b>{p.student}</b><small style={{display:"block"}}>{p.student_code||p.user_id}</small></td><td>{p.tests_taken}</td><td><span className="mu-live-pill online">{p.tests_submitted}</span></td><td><span className={"mu-live-pill "+(p.pending_tests?"exam":"online")}>{p.pending_tests}</span></td><td>{p.average_score===null?"—":p.average_score}</td><td>{p.latest_score===null?"—":p.latest_score}</td></tr>)}{!data?.student_performance?.length&&<tr><td colSpan={6}>No student test attempts recorded today.</td></tr>}</tbody></table></div></section>
    <section className="admin-panel mu-live-panel"><div className="admin-panel-title"><div><span className="admin-kicker">TODAY'S EXAM ACTIVITY</span><h2>Recent Test Starts</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Test</th><th>Started</th><th>Score</th><th>Correct / Wrong / Skipped</th><th>Status</th></tr></thead><tbody>{(data?.recent_activity||[]).map((a:any)=><tr key={a.id}><td><b>{a.student}</b><small style={{display:"block"}}>{a.student_code}</small></td><td>{a.test}</td><td>{indiaTime(a.started_at,true)}</td><td>{a.submitted?`${a.score ?? 0} / ${a.total ?? 0} (${a.accuracy ?? 0}%)`:"—"}</td><td>{a.submitted?`${a.correct ?? 0} / ${a.wrong ?? 0} / ${a.skipped ?? 0}`:"Pending"}</td><td><span className={"mu-live-pill "+(a.submitted?"online":"exam")}>{a.submitted?"Submitted":"In progress"}</span></td></tr>)}{!data?.recent_activity?.length&&<tr><td colSpan={6}>No test activity recorded today.</td></tr>}</tbody></table></div>
    </section>
    <p className="admin-muted mu-live-footnote">Presence is refreshed while a student has the site open and visible. A student may be marked offline after 75 seconds without a heartbeat. Browser closing, network loss and mobile background restrictions can delay status changes.</p>
  </main>;
}
