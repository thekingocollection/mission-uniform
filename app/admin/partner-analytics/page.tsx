"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-client-session";

type PartnerRow = { id:string; name:string; code:string; status:string; clicks:number; registrations:number; conversion_rate:number; clicks_today:number; registrations_today:number };
type Activity = { id:string; kind:"click"|"registration"; partner_id:string; partner:string; at:string; detail:string; meta:string };
type Analytics = { totals:{ clicks:number; registrations:number; clicks_today:number; registrations_today:number; conversion_rate:number; partners:number }; partners:PartnerRow[]; activity:Activity[]; refreshed_at:string };

export default function PartnerLiveAnalyticsPage() {
  const [data,setData] = useState<Analytics|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [auto,setAuto] = useState(true);
  const [lastUpdated,setLastUpdated] = useState("");
  const [now,setNow] = useState(new Date());
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await adminFetch("/api/admin/partner-analytics");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analytics load nahi ho paya.");
      setData(result); setLastUpdated(result.refreshed_at || new Date().toISOString()); setError("");
    } catch (e:any) { setError(e.message || "Data refresh failed."); }
    finally { setLoading(false); busy.current = false; }
  }, []);

  useEffect(() => { void load(); const clock=window.setInterval(()=>setNow(new Date()),1000); return ()=>window.clearInterval(clock); },[load]);
  useEffect(() => {
    if (!auto) return;
    const timer=window.setInterval(()=>{ if(document.visibilityState==="visible") void load(); },10000);
    return ()=>window.clearInterval(timer);
  },[auto,load]);

  const totals=data?.totals;
  const time=(value:string)=>new Date(value).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const cards=[
    ["Total Link Clicks",totals?.clicks??0,"All-time tracked partner link visits","clicks"],
    ["Total Registrations",totals?.registrations??0,"Students attributed to partner links","registrations"],
    ["Conversion Rate",String(totals?.conversion_rate??0)+"%","Registrations ÷ tracked clicks","conversion"],
    ["Active Partners",totals?.partners??0,"All partner accounts","partners"],
    ["Clicks Today",totals?.clicks_today??0,"Since 00:00 India time","today-clicks"],
    ["Registrations Today",totals?.registrations_today??0,"Since 00:00 India time","today-registers"]
  ];

  return <main className="mu-partner-analytics">
    <div className="admin-page-heading">
      <div><span className="admin-kicker">GROWTH INTELLIGENCE · REFERRAL TRACKING</span><h1>Partner Live Analytics</h1><p>Track partner link clicks, student registrations and conversion performance in one place.</p></div>
      <div className="mu-pa-actions"><span className="mu-pa-clock">{new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(now)} IST</span><button className={"admin-action "+(auto?"active":"")} onClick={()=>setAuto(v=>!v)}>{auto?"● Auto refresh ON":"○ Auto refresh OFF"}</button><button className="admin-action" onClick={()=>void load()} disabled={loading}>↻ Refresh Now</button></div>
    </div>
    <div className="mu-pa-status"><span><i/> {auto?"LIVE · AUTO UPDATING EVERY 10 SECONDS":"AUTO REFRESH PAUSED"}</span><small>{lastUpdated?"Last updated "+time(lastUpdated)+" IST":"Waiting for first data refresh…"}</small></div>
    {error&&<div className="admin-inline-message" role="alert">{error}</div>}
    <section className="mu-pa-grid">{cards.map(([label,value,desc,key])=><article className={"mu-pa-card "+key} key={String(key)}><span>{label}</span><strong>{loading?"—":value}</strong><small>{desc}</small></article>)}</section>
    <section className="admin-panel mu-pa-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">PARTNER-WISE PERFORMANCE</span><h2>Clicks & Registrations</h2><p className="admin-muted">Lifetime totals and today's activity for each partner referral code.</p></div><span className="mu-live-count">{data?.partners.length||0} PARTNERS</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Partner</th><th>Referral ID</th><th>Total Clicks</th><th>Registrations</th><th>Conversion</th><th>Today Clicks</th><th>Today Registrations</th><th>Status</th></tr></thead><tbody>
        {(data?.partners||[]).map(p=><tr key={p.id}><td><b>{p.name}</b></td><td><code>{p.code}</code></td><td><b>{p.clicks.toLocaleString("en-IN")}</b></td><td><b>{p.registrations.toLocaleString("en-IN")}</b></td><td><span className="mu-pa-conversion">{p.conversion_rate}%</span></td><td>{p.clicks_today}</td><td>{p.registrations_today}</td><td><span className={"mu-pa-badge "+(p.status==="approved"?"approved":"")}>{p.status}</span></td></tr>)}
        {!data?.partners.length&&<tr><td colSpan={8}>{loading?"Loading partner metrics…":"No partner records found."}</td></tr>}
      </tbody></table></div>
    </section>
    <section className="admin-panel mu-pa-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">RECENT REFERRAL EVENTS</span><h2>Live Activity Feed</h2><p className="admin-muted">Most recent clicks and registrations across all partners.</p></div><span className="mu-live-count">{data?.activity.length||0} EVENTS</span></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Partner</th><th>Event</th><th>Details</th><th>Time (IST)</th></tr></thead><tbody>
        {(data?.activity||[]).map(event=><tr key={event.id}><td><b>{event.partner}</b></td><td><span className={"mu-pa-event "+(event.kind==="registration"?"registration":"")}>{event.kind==="click"?"Link Click":"Registration"}</span></td><td>{event.detail}<small className="mu-pa-meta">{event.meta}</small></td><td>{time(event.at)}</td></tr>)}
        {!data?.activity.length&&<tr><td colSpan={4}>{loading?"Loading activity…":"No referral activity recorded yet."}</td></tr>}
      </tbody></table></div>
    </section>
    <p className="admin-muted mu-pa-note">Counts update every 10 seconds while this page is open. Click tracking is counted once per partner/browser visitor key as currently implemented; registrations come from the partner referral attribution saved during student account creation.</p>
  </main>;
}
