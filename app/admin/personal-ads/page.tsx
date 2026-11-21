"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Megaphone, Plus, Save, Trash2 } from "lucide-react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
const positions = [
  ["home_hero","Homepage – hero ke neeche"],["article_inline","Study article"],["study_material_end","Study material ke baad"],["result_below","Result ke neeche"],["footer","Footer"]
];
type Campaign = { id:string; title:string; description:string|null; image_url:string|null; destination_url:string; button_text:string|null; placement:string; starts_at:string; ends_at:string; status:string; };
const empty = { title:"", description:"", image_url:"", destination_url:"", button_text:"Learn more", placement:"home_hero", starts_at:new Date().toISOString().slice(0,16), ends_at:new Date(Date.now()+7*86400000).toISOString().slice(0,16), status:"draft" };

export default function PersonalAdsAdmin() {
  const [rows,setRows]=useState<Campaign[]>([]);
  const [form,setForm]=useState<any>(empty);
  const [editing,setEditing]=useState<string|null>(null);
  const [message,setMessage]=useState("Admin login required.");
  const [busy,setBusy]=useState(false);

  async function load() {
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage("Please sign in with an authorized admin account.");return;}
    const {data,error}=await supabase.from("personal_ad_campaigns").select("*").order("created_at",{ascending:false});
    if(error){setMessage("Could not load campaigns. Run personal_ads.sql and check admin role.");return;}
    setRows(data||[]);setMessage("Campaign list loaded.");
  }
  useEffect(()=>{void load();},[]);
  function change(k:string,v:string){setForm((f:any)=>({...f,[k]:v}));}
  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    const payload={...form,starts_at:new Date(form.starts_at).toISOString(),ends_at:new Date(form.ends_at).toISOString()};
    const result=editing
      ? await supabase.from("personal_ad_campaigns").update(payload).eq("id",editing)
      : await supabase.from("personal_ad_campaigns").insert(payload);
    setMessage(result.error ? result.error.message : "Campaign saved.");
    setBusy(false);
    if(!result.error){setForm(empty);setEditing(null);await load();}
  }
  async function edit(row:Campaign){
    setEditing(row.id);setForm({...row,starts_at:new Date(row.starts_at).toISOString().slice(0,16),ends_at:new Date(row.ends_at).toISOString().slice(0,16)});
  }
  async function remove(id:string){
    if(!confirm("Delete this campaign?"))return;
    const {error}=await supabase.from("personal_ad_campaigns").delete().eq("id",id);
    setMessage(error?error.message:"Campaign deleted.");if(!error)await load();
  }
  return <main className="personal-ads-admin">
    <header><div><span>MISSION UNIFORM OP / ADMIN</span><h1><Megaphone/> Personal Promotions</h1><p>Run your own sponsored promotions alongside AdSense, without interrupting tests.</p></div></header>
    <form onSubmit={save} className="personal-ads-form">
      <h2>{editing?"Edit campaign":"Create a promotion"}</h2>
      <label>Advertisement title<input required maxLength={90} value={form.title} onChange={e=>change("title",e.target.value)} placeholder="e.g. Odisha Police Exam Guide"/></label>
      <label>Description<textarea maxLength={240} value={form.description} onChange={e=>change("description",e.target.value)}/></label>
      <label>Banner image URL (optional)<input type="url" value={form.image_url} onChange={e=>change("image_url",e.target.value)} placeholder="https://..."/></label>
      <label>Destination URL<input required type="url" value={form.destination_url} onChange={e=>change("destination_url",e.target.value)} placeholder="https://your-website.com"/></label>
      <div className="personal-ads-grid">
        <label>Placement<select value={form.placement} onChange={e=>change("placement",e.target.value)}>{positions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Button text<input maxLength={24} value={form.button_text} onChange={e=>change("button_text",e.target.value)}/></label>
        <label>Start date/time<input required type="datetime-local" value={form.starts_at} onChange={e=>change("starts_at",e.target.value)}/></label>
        <label>Expiry date/time<input required type="datetime-local" value={form.ends_at} onChange={e=>change("ends_at",e.target.value)}/></label>
        <label>Status<select value={form.status} onChange={e=>change("status",e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
      <div className="personal-ads-actions"><button disabled={busy}><Save size={16}/> {busy?"Saving...":"Save promotion"}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(null);setForm(empty)}}>Cancel edit</button>}</div>
    </form>
    <section className="personal-ads-list"><h2>Your campaigns</h2>{rows.length===0?<p>No campaigns yet.</p>:rows.map(r=><article key={r.id}>
      <div><strong>{r.title}</strong><small>{r.placement} · {r.status} · expires {new Date(r.ends_at).toLocaleString()}</small></div>
      <button onClick={()=>edit(r)}>Edit</button><button className="danger" onClick={()=>remove(r.id)}><Trash2 size={14}/> Delete</button>
    </article>)}</section>
    <p className="personal-ads-message">{message}</p>
    <p className="personal-ads-disclosure">All campaigns display a “Sponsored” label. Only outbound clicks are recorded here; a click is not counted as a sale or confirmed conversion.</p>
  </main>;
}
