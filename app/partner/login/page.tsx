"use client";
import { useState } from "react";
import { partnerSupabaseBrowser } from "@/lib/partner-supabase-browser";

export default function PartnerLogin(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const sb=partnerSupabaseBrowser();if(!sb)throw new Error("Login service unavailable.");
      const {data,error}=await sb.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
      if(error)throw error;
      if(!data.session)throw new Error("Could not create login session.");
      const response=await fetch("/api/partner",{headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store"});
      const result=await response.json();
      if(!response.ok||!result.partner){await sb.auth.signOut();throw new Error("This login is not registered as a Mission Uniform partner. Please contact Admin.");}
      window.location.replace("/partner");
    }catch(e:any){setMessage(e.message||"Login failed.");}
    finally{setBusy(false);}
  }
  return <main style={{minHeight:"75vh",display:"grid",placeItems:"center",padding:20,background:"#f4f7fb"}}>
    <section style={{width:"100%",maxWidth:440,padding:30,borderRadius:20,border:"1px solid #dbe3ed",background:"#fff",boxShadow:"0 16px 45px rgba(20,43,69,.08)"}}>
      <span style={{fontSize:12,fontWeight:800,letterSpacing:2,color:"#99712c"}}>MISSION UNIFORM OP</span>
      <h1 style={{fontSize:30,color:"#152b45",margin:"12px 0 6px"}}>Partner Login</h1>
      <p style={{color:"#68788a",marginTop:0}}>Use the username and password provided by Admin.</p>
      <form onSubmit={submit} style={{display:"grid",gap:14,marginTop:22}}>
        <label style={{fontWeight:700}}>Email / Username<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your registered email" style={{display:"block",width:"100%",padding:13,border:"1px solid #ccd6e2",borderRadius:10,marginTop:7}}/></label>
        <label style={{fontWeight:700}}>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" style={{display:"block",width:"100%",padding:13,border:"1px solid #ccd6e2",borderRadius:10,marginTop:7}}/></label>
        {message&&<p role="alert" style={{color:"#b42318",fontSize:14}}>{message}</p>}
        <button disabled={busy} style={{padding:14,border:0,borderRadius:10,background:"#173e68",color:"#fff",fontWeight:800}}>{busy?"Signing in…":"Login to Partner Panel"}</button>
      </form>
    </section>
  </main>;
}
