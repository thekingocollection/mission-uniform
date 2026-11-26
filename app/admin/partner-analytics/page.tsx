"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-client-session";

type PartnerRow = { id:string; name:string; code:string; status:string; clicks:number; registrations:number; conversion_rate:number; clicks_today:number; registrations_today:number };
type Activity = { id:string; kind:"click"|"registration"; partner_id:string; partner:string; at:string; detail:string; meta:string };
type Analytics = { totals:{ clicks:number; registrations:number; clicks_today:number; registrations_today:number; conversion_rate:number; partners:number }; partners:PartnerRow[]; activity:Activity[]; refreshed_at:string };
type SortKey = "clicks"|"registrations"|"conversion_rate"|"clicks_today"|"registrations_today";

export default function PartnerLiveAnalyticsPage() {
  const [data,setData] = useState<Analytics|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [auto,setAuto] = useState(true);
  const [lastUpdated,setLastUpdated] = useState("");
  const [now,setNow] = useState(new Date());
  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [sortBy,setSortBy] = useState<SortKey>("registrations");
  const [activityFilter,setActivityFilter] = useState<"all"|"click"|"registration">("all");
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
  const filteredPartners=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return [...(data?.partners||[])].filter(p=>(!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) && (statusFilter==="all" || p.status===statusFilter)).sort((a,b)=>b[sortBy]-a[sortBy]);
  },[data,search,statusFilter,sortBy]);
  const filteredActivity=useMemo(()=>(data?.activity||[]).filter(e=>activityFilter==="all"||e.kind===activityFilter),[data,activityFilter]);
  const topPartner=useMemo(()=>[...(data?.partners||[])].sort((a,b)=>b.registrations-a.registrations)[0],[data]);
  const cards=[
    ["Total Link Clicks",totals?.clicks??0,"All-time tracked visits","clicks"],
    ["Student Registrations",totals?.registrations??0,"Partner-attributed sign-ups","registrations"],
    ["Conversion Rate",String(totals?.conversion_rate??0)+"%","Registrations ÷ tracked clicks","conversion"],
    ["Total Partners",totals?.partners??0,"Partner accounts","partners"],
    ["Clicks Today",totals?.clicks_today??0,"Since 12:00 AM IST","today-clicks"],
    ["Registrations Today",totals?.registrations_today??0,"Since 12:00 AM IST","today-registers"]
  ];

  return <main className="mu-partner-analytics">
    <div className="admin-page-heading">
      <div><span className="admin-kicker">GROWTH INTELLIGENCE · REFERRAL TRACKING</span><h1>Partner Live Analytics</h1><p>Partner clicks aur student registrations ko aasani se track karein.</p></div>
      <div className="mu-pa-actions"><span className="mu-pa-clock">{new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(now)} IST</span><button className={"admin-action "+(auto?"active":"")} onClick={()=>setAuto(v=>!v)}>{auto?"● Auto ON":"○ Auto OFF"}</button><button className="admin-action" onClick={()=>void load()} disabled={loading}>↻ Refresh</button></div>
    </div>
    <div className="mu-pa-status"><span><i/> {auto?"LIVE · UPDATES EVERY 10 SECONDS":"AUTO REFRESH PAUSED"}</span><small>{lastUpdated?"Last updated "+time(lastUpdated)+" IST":"Waiting for first refresh…"}</small></div>
    {error&&<div className="admin-inline-message" role="alert">{error}<button onClick={()=>void load()}>Try again</button></div>}
    <section className="mu-pa-grid">{cards.map(([label,value,desc,key])=><article className={"mu-pa-card "+key} key={String(key)}><span>{label}</span><strong>{loading?"—":value}</strong><small>{desc}</small></article>)}</section>

    <section className="mu-pa-quick-insight">
      <div><span className="admin-kicker">TOP PERFORMER</span><strong>{topPartner?.name||"No partner data yet"}</strong><small>{topPartner?topPartner.registrations+" registrations · "+topPartner.clicks+" clicks":"Partner performance will appear here after referrals."}</small></div>
      <div><span className="admin-kicker">QUICK GUIDE</span><p>Clicks = unique tracked visitor keys. Registrations = sign-ups attributed to partner referral codes.</p></div>
    </section>

    <section className="admin-panel mu-pa-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">PARTNER-WISE PERFORMANCE</span><h2>Find a Partner</h2><p className="admin-muted">Search by name/code, filter status, or sort results.</p></div><span className="mu-live-count">{filteredPartners.length} / {data?.partners.length||0}</span></div>
      <div className="mu-pa-filters">
        <label className="mu-pa-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search partner name or referral code…" aria-label="Search partners"/></label>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter partner status"><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortKey)} aria-label="Sort partners"><option value="registrations">Sort: Most registrations</option><option value="clicks">Sort: Most clicks</option><option value="conversion_rate">Sort: Best conversion</option><option value="clicks_today">Sort: Today's clicks</option><option value="registrations_today">Sort: Today's sign-ups</option></select>
        {(search||statusFilter!=="all")&&<button className="mu-pa-clear" onClick={()=>{setSearch("");setStatusFilter("all");}}>Clear filters</button>}
      </div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Partner</th><th>Referral Code</th><th>Total Clicks</th><th>Registrations</th><th>Conversion</th><th>Today Clicks</th><th>Today Sign-ups</th><th>Status</th></tr></thead><tbody>
        {filteredPartners.map(p=><tr key={p.id}><td><b>{p.name}</b></td><td><code>{p.code}</code></td><td><b>{p.clicks.toLocaleString("en-IN")}</b></td><td><b>{p.registrations.toLocaleString("en-IN")}</b></td><td><span className="mu-pa-conversion">{p.conversion_rate}%</span></td><td>{p.clicks_today}</td><td>{p.registrations_today}</td><td><span className={"mu-pa-badge "+(p.status==="approved"?"approved":"")}>{p.status}</span></td></tr>)}
        {!filteredPartners.length&&<tr><td colSpan={8} className="mu-pa-empty">{loading?"Loading partner metrics…":"No matching partners. Try changing the search or filters."}</td></tr>}
      </tbody></table></div>
    </section>

    <section className="admin-panel mu-pa-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">RECENT REFERRAL EVENTS</span><h2>Activity Timeline</h2><p className="admin-muted">Latest partner link clicks and attributed registrations.</p></div><span className="mu-live-count">{filteredActivity.length} EVENTS</span></div>
      <div className="mu-pa-tabs"><button className={activityFilter==="all"?"selected":""} onClick={()=>setActivityFilter("all")}>All activity</button><button className={activityFilter==="click"?"selected":""} onClick={()=>setActivityFilter("click")}>Link clicks</button><button className={activityFilter==="registration"?"selected":""} onClick={()=>setActivityFilter("registration")}>Registrations</button></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Partner</th><th>Activity</th><th>Details</th><th>Time (IST)</th></tr></thead><tbody>
        {filteredActivity.map(event=><tr key={event.id}><td><b>{event.partner}</b></td><td><span className={"mu-pa-event "+(event.kind==="registration"?"registration":"")}>{event.kind==="click"?"Link Click":"Registration"}</span></td><td>{event.detail}<small className="mu-pa-meta">{event.meta}</small></td><td>{time(event.at)}</td></tr>)}
        {!filteredActivity.length&&<tr><td colSpan={4} className="mu-pa-empty">No activity in this category yet.</td></tr>}
      </tbody></table></div>
    </section>
    <p className="admin-muted mu-pa-note">Auto refresh works every 10 seconds while this page is open. Clicks are counted once per partner/browser visitor key. Registrations depend on referral attribution saved during student sign-up.</p>
  </main>;
}
