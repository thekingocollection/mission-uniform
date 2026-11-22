"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Ad = {id:string;title:string;description:string|null;image_url:string|null;target_url:string;placement:string;is_active:boolean;starts_at:string|null;ends_at:string|null;priority:number;created_at:string};
const empty = {title:"",description:"",image_url:"",target_url:"",placement:"global_top",is_active:false,starts_at:"",ends_at:"",priority:0};
const placements = [{value:"global_top",label:"Main pages · below navigation"},{value:"dashboard_top",label:"Student dashboard · top"},{value:"syllabus_top",label:"Syllabus · top"},{value:"below_content",label:"Below page content"}];
export default function SponsorAdsPage(){
 const sb=useMemo(()=>supabaseBrowser(),[]); const [rows,setRows]=useState<Ad[]>([]); const [form,setForm]=useState<any>(empty); const [editing,setEditing]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
 const headers=useCallback(async()=>{const {data}=await sb!.auth.getSession();return { "Content-Type":"application/json",Authorization:"Bearer "+(data.session?.access_token||"")}},[sb]);
 const load=useCallback(async()=>{if(!sb)return;const h=await headers();const r=await fetch("/api/admin/sponsor-ads",{headers:h});const d=await r.json();if(r.ok)setRows(d.ads||[]);else setMsg(d.error||"Could not load banners.")},[sb,headers]);
 useEffect(()=>{void load()},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");try{const h=await headers();const r=await fetch("/api/admin/sponsor-ads",{method:"POST",headers:h,body:JSON.stringify({...form,id:editing})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Save failed");setForm(empty);setEditing(null);setMsg("Sponsor banner saved.");await load()}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
 async function remove(id:string){if(!confirm("Delete this sponsor banner?"))return;const h=await headers();const r=await fetch("/api/admin/sponsor-ads?id="+id,{method:"DELETE",headers:h});const d=await r.json();if(!r.ok){setMsg(d.error||"Delete failed");return}setMsg("Banner deleted.");await load()}
 function edit(a:Ad){setEditing(a.id);setForm({title:a.title,description:a.description||"",image_url:a.image_url||"",target_url:a.target_url,placement:a.placement,is_active:a.is_active,starts_at:a.starts_at?.slice(0,16)||"",ends_at:a.ends_at?.slice(0,16)||"",priority:a.priority||0});window.scrollTo({top:0,behavior:"smooth"})}
 return <><div className="admin-page-heading"><div><span className="admin-kicker">REVENUE & PARTNERSHIPS</span><h1>Sponsor Banners</h1><p>Create, schedule and control sponsor placements across student pages.</p></div><span className="admin-date">{rows.length} BANNERS</span></div>
 {msg&&<div className="admin-inline-message">{msg}</div>}
 <section className="admin-panel"><h2>{editing?"Edit sponsor banner":"Add sponsor banner"}</h2><form onSubmit={save} className="admin-form-grid">
 <label>Banner title<input required maxLength={100} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Trusted coaching partner"/></label>
 <label>Destination URL<input required type="url" value={form.target_url} onChange={e=>setForm({...form,target_url:e.target.value})} placeholder="https://example.com"/></label>
 <label className="wide">Short description<input maxLength={220} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional one-line message"/></label>
 <label className="wide">Banner image URL<input type="url" value={form.image_url} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://.../banner.webp (optional)"/></label>
 <label>Placement<select value={form.placement} onChange={e=>setForm({...form,placement:e.target.value})}>{placements.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
 <label>Priority<input type="number" min={-100} max={100} value={form.priority} onChange={e=>setForm({...form,priority:Number(e.target.value)})}/></label>
 <label>Start time<input type="datetime-local" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
 <label>End time<input type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label>
 <label className="admin-switch wide"><span><b>Publish banner</b><small>Turn off to keep it saved but hidden from students.</small></span><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/></label>
 <div className="wide" style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="admin-primary" disabled={busy}>{busy?"Saving…":editing?"Update Banner":"Save Banner"}</button>{editing&&<button type="button" className="admin-secondary" onClick={()=>{setEditing(null);setForm(empty)}}>Cancel edit</button>}</div>
 </form></section>
 <section className="admin-panel"><h2>Saved banners</h2>{rows.length===0?<p className="admin-muted">No sponsor banners added yet.</p>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Banner</th><th>Placement</th><th>Status</th><th>Schedule</th><th>Actions</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td><b>{a.title}</b><small>{a.target_url}</small></td><td>{placements.find(p=>p.value===a.placement)?.label||a.placement}</td><td><span className={a.is_active?"admin-status-live":"admin-status-paused"}>{a.is_active?"Published":"Paused"}</span></td><td>{a.starts_at?new Date(a.starts_at).toLocaleString():"Now"}<br/>{a.ends_at?"Until "+new Date(a.ends_at).toLocaleString():"No end date"}</td><td><button className="admin-secondary" onClick={()=>edit(a)}>Edit</button> <button className="admin-danger" onClick={()=>void remove(a.id)}>Delete</button></td></tr>)}</tbody></table></div>}</section>
 <p className="admin-muted">Recommended: use one small banner per page, clearly labelled Sponsored. Avoid pop-ups, auto-play media and banners inside active tests. Use image URLs hosted on your website or a trusted CDN.</p></>;
}
