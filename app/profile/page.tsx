"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHero } from "@/components/content-page";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Profile() {
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const router=useRouter();

  useEffect(()=>{
    let active=true;
    (async()=>{
      const sb=supabaseBrowser();
      if(!sb){router.replace("/login?next=/profile");return;}
      const {data:{user},error}=await sb.auth.getUser();
      if(error||!user){router.replace("/login?next=/profile");return;}
      const {data}=await sb.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
      if(!active)return;
      setName(data?.full_name||String(user.user_metadata?.full_name||""));
      setPhone(user.phone||"");
      setEmail(user.email||"");
      setLoading(false);
    })();
    return()=>{active=false};
  },[router]);

  async function save(){
    const sb=supabaseBrowser();if(!sb)return;
    if(name.trim().length<2){setMessage("Please enter your full name.");return;}
    setSaving(true);setMessage("");
    const {data:{user}}=await sb.auth.getUser();
    if(!user){router.replace("/login?next=/profile");return;}
    const {error}=await sb.from("profiles").upsert({id:user.id,full_name:name.trim()},{onConflict:"id"});
    setMessage(error?error.message:"Profile updated successfully.");
    setSaving(false);
  }

  async function logout(){
    const sb=supabaseBrowser();if(sb)await sb.auth.signOut();
    router.replace("/");router.refresh();
  }

  if(loading)return <section className="panel">Loading your profile…</section>;
  return <><PageHero eyebrow="STUDENT ACCOUNT" title="My Profile" desc="Manage your MISSION UNIFORM OP student account."/>
    <section className="panel" style={{maxWidth:680,margin:"0 auto 32px"}}>
      <span className="eyebrow">PERSONAL DETAILS</span><h2>Student Information</h2>
      <label>Full Name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label>
      <label>Registered Mobile Number<input className="input" value={phone} readOnly/></label>
      {email&&<label>Email<input className="input" value={email} readOnly/></label>}
      <div className="result-actions"><button className="btn primary" disabled={saving} onClick={()=>void save()}>{saving?"Saving…":"Save Changes"}</button><button className="btn secondary" onClick={()=>void logout()}>Logout</button></div>
      {message&&<p className="notice" role="status">{message}</p>}
    </section>
  </>;
}
