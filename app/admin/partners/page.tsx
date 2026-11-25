"use client";
import { useCallback, useEffect, useState } from "react";
import { adminSupabaseBrowser } from "@/lib/admin-supabase-browser";

async function getAdminToken(sb:any){if(!sb)throw new Error("Supabase client unavailable. Check Render environment variables.");let {data:{session}}=await sb.auth.getSession();if(!session?.access_token){const refreshed=await sb.auth.refreshSession();session=refreshed.data.session;if(refreshed.error)throw new Error("Admin session refresh failed: "+refreshed.error.message);if(!session?.access_token)throw new Error("No saved Admin login session found in this browser. Please sign in again at /admin/login.");}return session.access_token;}

export default function AdminPartners() {
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [createForm,setCreateForm]=useState({name:"",email:"",phone:"",password:"",referral_code:"",commission_rate:""});
  const [createdCredentials,setCreatedCredentials]=useState<any>(null);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const sb=adminSupabaseBrowser();const token=await getAdminToken(sb);
      const res=await fetch("/api/admin/partners",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Could not load partners.");
      setRows(body.partners||[]);
    }catch(e:any){setMessage(e.message||"Could not load partners.");}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  function edit(id:string,patch:any){setRows(old=>old.map(r=>r.id===id?{...r,...patch}:r));}
  async function createPartner(e:React.FormEvent){
    e.preventDefault();setBusy("create");setMessage("");setCreatedCredentials(null);
    try{
      const sb=adminSupabaseBrowser();const token=await getAdminToken(sb);
      const res=await fetch("/api/admin/partners/create",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(createForm)});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Could not create partner.");
      setCreatedCredentials(body.credentials);setMessage("Partner ID created successfully. Share these login details securely with the partner.");
      setCreateForm({name:"",email:"",phone:"",password:"",referral_code:"",commission_rate:""});await load();
    }catch(e:any){setMessage(e.message||"Partner creation failed.");}finally{setBusy("");}
  }
  async function save(row:any,status:string){
    setBusy(row.id);setMessage("");
    try{
      const sb=adminSupabaseBrowser();const token=await getAdminToken(sb);
      const res=await fetch("/api/admin/partners",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({id:row.id,status,commission_rate:Number(row.commission_rate),referral_code:row.referral_code})});
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
    <section className="admin-panel" style={{marginBottom:18}}>
      <h2>Create Partner Login</h2>
      <p className="admin-muted">Admin creates the partner's username, password, referral ID and commission rate. Share credentials privately with the partner.</p>
      <form onSubmit={createPartner}>
        <div className="admin-form-grid">
          <label>Partner Name<input required minLength={2} value={createForm.name} onChange={e=>setCreateForm(v=>({...v,name:e.target.value}))} placeholder="Full name"/></label>
          <label>Login Email / Username<input required type="email" value={createForm.email} onChange={e=>setCreateForm(v=>({...v,email:e.target.value}))} placeholder="partner@email.com"/></label>
          <label>Mobile Number<input required inputMode="numeric" maxLength={10} value={createForm.phone} onChange={e=>setCreateForm(v=>({...v,phone:e.target.value.replace(/\\D/g,"").slice(0,10)}))} placeholder="10-digit mobile"/></label>
          <label>Temporary Password<input required minLength={8} value={createForm.password} onChange={e=>setCreateForm(v=>({...v,password:e.target.value}))} placeholder="At least 8 characters"/></label>
          <label>Partner Referral ID<input required minLength={3} maxLength={20} value={createForm.referral_code} onChange={e=>setCreateForm(v=>({...v,referral_code:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")}))} placeholder="e.g. RAHUL01"/></label>
          <label>Commission Rate (%)<input required type="number" min="0.1" max="100" step="0.5" value={createForm.commission_rate} onChange={e=>setCreateForm(v=>({...v,commission_rate:e.target.value}))} placeholder="Admin decides"/></label>
        </div>
        <button className="admin-primary" type="submit" disabled={busy==="create"}>{busy==="create"?"Creating Partner…":"＋ Create Partner Account"}</button>
      </form>
      {createdCredentials&&<div style={{marginTop:16,padding:16,borderRadius:12,background:"#edf8f1",border:"1px solid #b9dfc7"}}>
        <b>Partner login created — share privately</b>
        <p>Email / Username: <strong>{createdCredentials.email}</strong></p>
        <p>Temporary Password: <strong>{createdCredentials.password}</strong></p>
        <p>Partner Login: <strong>https://mission-uniform.onrender.com/partner/login</strong></p>
        <button type="button" className="admin-ghost" onClick={()=>navigator.clipboard.writeText("Username: "+createdCredentials.email+"\\nPassword: "+createdCredentials.password+"\\nLogin: https://mission-uniform.onrender.com/partner/login")}>Copy Login Details</button>
        <p className="admin-muted">Ask the partner to change this password after first login. This password is shown only in this creation confirmation.</p>
      </div>}
    </section>
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
