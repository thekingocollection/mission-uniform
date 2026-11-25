"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AdminPartners() {
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const sb=supabaseBrowser();const {data:{session}}=await sb!.auth.getSession();
      if(!session)throw new Error("Admin login required.");
      const res=await fetch("/api/admin/partners",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Could not load partners.");
      setRows(body.partners||[]);
    }catch(e:any){setMessage(e.message||"Could not load partners.");}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  function edit(id:string,patch:any){setRows(old=>old.map(r=>r.id===id?{...r,...patch}:r));}
  async function save(row:any,status:string){
    setBusy(row.id);setMessage("");
    try{
      const sb=supabaseBrowser();const {data:{session}}=await sb!.auth.getSession();if(!session)throw new Error("Admin session expired.");
      const res=await fetch("/api/admin/partners",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({id:row.id,status,commission_rate:Number(row.commission_rate),referral_code:row.referral_code})});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Could not save partner.");
      setMessage("Partner details updated.");await load();
    }catch(e:any){setMessage(e.message||"Update failed.");}finally{setBusy("");}
  }
  return <div>
    <div className="admin-page-heading"><div><span className="admin-kicker">GROWTH & AFFILIATE CONTROL</span><h1>Partnership Management</h1><p>Review partner requests, approve referral IDs and set individual commission percentages.</p></div><button className="admin-ghost" onClick={()=>void load()}>↻ Refresh</button></div>
    <div className="admin-stat-grid">
      <div className="admin-stat-card"><small>Total Partners</small><b>{rows.length}</b></div>
      <div className="admin-stat-card"><small>Pending Requests</small><b>{rows.filter(r=>r.status==="pending").length}</b></div>
      <div className="admin-stat-card"><small>Approved Partners</small><b>{rows.filter(r=>r.status==="approved").length}</b></div>
    </div>
    {message&&<p className="admin-inline-message">{message}</p>}
    {loading?<p className="admin-muted">Loading partners…</p>:rows.map(row=><section key={row.id} className="admin-panel" style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><h2 style={{marginBottom:4}}>{row.display_name}</h2><p className="admin-muted">{row.profiles?.full_name||"Partner account"} · {row.profiles?.student_code||row.user_id}</p></div><span className={"admin-pill "+(row.status==="approved"?"active":"blocked")}>{row.status}</span></div>
      <div className="admin-form-grid">
        <label>Referral Code<input value={row.referral_code||""} onChange={e=>edit(row.id,{referral_code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")})} placeholder="e.g. RAHUL01"/></label>
        <label>Commission Rate (%)<input type="number" min="0" max="100" step="0.5" value={row.commission_rate} onChange={e=>edit(row.id,{commission_rate:e.target.value})}/></label>
      </div>
      <div className="admin-stat-grid" style={{marginTop:12}}>
        <div className="admin-stat-card"><small>Referred Students</small><b>{row.referral_count||0}</b></div>
        <div className="admin-stat-card"><small>Premium Purchases</small><b>{row.premium_count||0}</b></div>
        <div className="admin-stat-card"><small>Commission Earned</small><b>₹{((row.commission_paise||0)/100).toFixed(2)}</b></div>
      </div>
      <div className="admin-actions" style={{marginTop:14}}>
        <button className="admin-primary" disabled={!!busy} onClick={()=>void save(row,"approved")}>{busy===row.id?"Saving…":"Approve & Save Rate"}</button>
        <button className="admin-ghost" disabled={!!busy} onClick={()=>void save(row,"inactive")}>Deactivate</button>
        <button className="admin-ghost" disabled={!!busy} onClick={()=>void save(row,"rejected")}>Reject</button>
      </div>
    </section>)}
    {!loading&&!rows.length&&<section className="admin-panel"><p className="admin-muted">No partnership requests yet.</p></section>}
  </div>;
}
