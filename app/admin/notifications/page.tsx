"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Campaign = { id:string; title:string; body:string; target_type:string; schedule_at:string; status:string; target_count:number; inapp_count:number; push_sent_count:number; push_failed_count:number; sent_at:string|null; error_message:string|null; metrics:{clicks:number;reads:number;pushSent:number;pushFailed:number} };
function localDateTime() { const d=new Date(Date.now()-new Date().getTimezoneOffset()*60000); return d.toISOString().slice(0,16); }
const audienceLabel:Record<string,string>={all:"All active student accounts",active_7d:"Active in last 7 days",inactive_2d:"Inactive for selected days",new_7d:"New registrations · last 7 days"};

export default function NotificationCampaignsPage() {
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [target,setTarget]=useState("all");
  const [days,setDays]=useState(2);
  const [url,setUrl]=useState("/notifications");
  const [schedule,setSchedule]=useState(localDateTime);
  const [inapp,setInapp]=useState(true);
  const [push,setPush]=useState(true);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const authHeaders=useCallback(async()=>{
    if(!sb)throw new Error("Admin session unavailable.");
    const {data}=await sb.auth.getSession();
    if(!data.session)throw new Error("Please sign in again.");
    return {Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"};
  },[sb]);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const response=await fetch("/api/admin/notification-campaigns",{headers:await authHeaders(),cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not load campaigns.");setCampaigns(result.campaigns||[]);}
    catch(e:any){setError(e.message||"Could not load campaigns.");}
    finally{setLoading(false);}
  },[authHeaders]);
  useEffect(()=>{void load();},[load]);

  async function create(sendNow:boolean){
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/admin/notification-campaigns",{method:"POST",headers:await authHeaders(),body:JSON.stringify({title,body,target_type:target,target_days:days,target_url:url,inapp_enabled:inapp,push_enabled:push,send_now:sendNow,schedule_at:new Date(schedule).toISOString()})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Campaign could not be created.");
      setMessage(sendNow?"Campaign queued for immediate delivery.":"Campaign scheduled successfully.");
      setTitle("");setBody("");await load();
    }catch(e:any){setError(e.message||"Campaign could not be created.");}
    finally{setBusy(false);}
  }

  async function processDue(){
    setBusy(true);setError("");setMessage("");
    try{const response=await fetch("/api/admin/notification-campaigns",{method:"PATCH",headers:await authHeaders(),body:JSON.stringify({action:"process_due"})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not process campaigns.");setMessage("Scheduler checked. "+(result.results||[]).length+" due campaign(s) processed.");await load();}
    catch(e:any){setError(e.message||"Could not process campaigns.");}
    finally{setBusy(false);}
  }

  return <main className="mu-campaign-admin">
    <div className="admin-page-heading"><div><span className="admin-kicker">STUDENT ENGAGEMENT · CAMPAIGN STUDIO</span><h1>Notification Campaigns</h1><p>Create in-app updates and Web Push campaigns, target student groups and track engagement.</p></div><button className="admin-action" onClick={()=>void load()} disabled={loading}>↻ Refresh</button></div>
    <div className="mu-campaign-info"><b>Delivery channels</b><span>In-app inbox · Browser push · Scheduled campaigns · Read and click tracking</span><small>Browser push uses Firebase Cloud Messaging (FCM); legacy VAPID Web Push remains supported. Students must allow notifications.</small></div>
    {message&&<div className="admin-inline-message" role="status">{message}</div>}
    {error&&<div className="admin-inline-message" role="alert">{error}</div>}
    <section className="admin-panel mu-campaign-form">
      <div className="admin-panel-title"><div><span className="admin-kicker">CREATE NEW CAMPAIGN</span><h2>Compose notification</h2><p className="admin-muted">Keep messages useful, short and relevant to exam preparation.</p></div></div>
      <form onSubmit={e=>{e.preventDefault();void create(false);}}>
        <div className="mu-campaign-fields">
          <label>Notification title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="🔥 Today's Daily Challenge is ready!"/></label>
          <label>Student audience<select value={target} onChange={e=>setTarget(e.target.value)}><option value="all">All students</option><option value="active_7d">Active in last 7 days</option><option value="inactive_2d">Inactive students</option><option value="new_7d">New registrations · last 7 days</option></select></label>
          {target==="inactive_2d"&&<label>Inactive for at least (days)<input type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label>}
          <label className="wide">Message<textarea required maxLength={1000} rows={4} value={body} onChange={e=>setBody(e.target.value)} placeholder="Aaj ka 25-question challenge complete kijiye aur apni preparation improve kijiye."/></label>
          <label>Open link<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="/notifications"/></label>
          <label>Schedule date & time<input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)} required/><small>Uses your device's local time. Store and delivery run on server time.</small></label>
        </div>
        <div className="mu-campaign-channels"><b>Delivery channels</b><label><input type="checkbox" checked={inapp} onChange={e=>setInapp(e.target.checked)}/> In-app Notification Centre</label><label><input type="checkbox" checked={push} onChange={e=>setPush(e.target.checked)}/> Web Push Notification</label></div>
        <div className="mu-campaign-actions"><button className="admin-primary" disabled={busy||!title.trim()||!body.trim()||(!inapp&&!push)} type="submit">{busy?"Saving…":"Schedule Campaign"}</button><button className="admin-action" disabled={busy||!title.trim()||!body.trim()||(!inapp&&!push)} type="button" onClick={()=>void create(true)}>↗ Send Now</button></div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">DELIVERY HISTORY</span><h2>Campaign performance</h2><p className="admin-muted">Recipients, push delivery, reads and notification clicks.</p></div><button className="admin-action" disabled={busy} onClick={()=>void processDue()}>▶ Process Due Campaigns</button></div>
      {loading?<p className="admin-muted">Loading campaign history…</p>:campaigns.length===0?<p className="admin-muted">No campaigns yet. Create your first notification above.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Audience</th><th>Status / Time</th><th>Recipients</th><th>Push</th><th>Reads / Clicks</th></tr></thead><tbody>{campaigns.map(c=><tr key={c.id}><td><b>{c.title}</b><small style={{display:"block"}}>{c.body.slice(0,90)}</small></td><td>{audienceLabel[c.target_type]||c.target_type}</td><td><span className={"mu-campaign-status "+c.status}>{c.status.toUpperCase()}</span><small style={{display:"block"}}>{new Date(c.sent_at||c.schedule_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST</small>{c.error_message&&<small className="mu-campaign-error">{c.error_message}</small>}</td><td>{c.target_count||"—"}<small style={{display:"block"}}>In-app: {c.inapp_count||0}</small></td><td>{c.push_sent_count||0} sent<small style={{display:"block"}}>{c.push_failed_count||0} failed</small></td><td>{c.metrics?.reads||0} / {c.metrics?.clicks||0}</td></tr>)}</tbody></table></div>}
    </section>
    <p className="admin-muted mu-campaign-footnote">Scheduled campaigns are processed by the secure scheduler endpoint. Configure an external cron to call it every minute; the manual Process Due Campaigns button is available for testing.</p>
  </main>;
}
