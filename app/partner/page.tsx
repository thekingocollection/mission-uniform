"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Payload = { partner: any; summary: any; referrals: any[]; commissions: any[]; payouts: any[] };
const money = (paise: number) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function PartnerDashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Portal unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please login to continue.");
      const response = await fetch("/api/partner", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load partner details.");
      setData(result);
    } catch (e: any) { setMessage(e.message || "Could not load partner dashboard."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function apply(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const sb = supabaseBrowser();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) throw new Error("Please login first.");
      const response = await fetch("/api/partner", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token }, body: JSON.stringify({ display_name: name }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Application failed.");
      setMessage(result.message || "Request submitted.");
      await load();
    } catch (e: any) { setMessage(e.message || "Could not submit request."); }
    finally { setBusy(false); }
  }

  if (loading) return <main style={{maxWidth:1000,margin:"50px auto",padding:20}}>Loading Partnership Panel…</main>;
  if (!data?.partner) return <main style={{maxWidth:760,margin:"40px auto",padding:20}}>
    <section style={{padding:28,border:"1px solid #dbe3ed",borderRadius:20,background:"#fff"}}>
      <span style={{color:"#8b6725",fontWeight:800,fontSize:12,letterSpacing:2}}>MISSION UNIFORM OP</span>
      <h1 style={{fontSize:32,color:"#152b45",margin:"12px 0"}}>Become a Partnership Partner</h1>
      <p style={{color:"#5d6d7e",lineHeight:1.7}}>Apply to promote Mission Uniform OP. After a discussion, Admin will approve your account, assign your unique referral link and decide your commission percentage.</p>
      {message && <p role="status" style={{color:"#9a4b16"}}>{message}</p>}
      <form onSubmit={apply} style={{display:"grid",gap:12,marginTop:22}}>
        <label style={{fontWeight:700}}>Your Name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" style={{display:"block",width:"100%",padding:13,border:"1px solid #ccd6e2",borderRadius:10,marginTop:7}}/></label>
        <button disabled={busy} style={{padding:14,border:0,borderRadius:10,background:"#173e68",color:"#fff",fontWeight:800}}>{busy?"Submitting…":"Submit Partnership Request"}</button>
      </form>
    </section>
  </main>;

  const p = data.partner, s = data.summary || {};
  const link = p.referral_code ? (typeof window !== "undefined" ? window.location.origin : "") + "/signup?ref=" + p.referral_code : "";
  return <main style={{maxWidth:1120,margin:"30px auto",padding:"16px",color:"#152b45"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center",marginBottom:22}}>
      <div><span style={{fontSize:12,fontWeight:800,letterSpacing:2,color:"#99712c"}}>MISSION UNIFORM OP</span><h1 style={{fontSize:30,margin:"6px 0"}}>Partnership Dashboard</h1><p style={{margin:0,color:"#68788a"}}>Welcome, {p.display_name}</p></div>
      <span style={{padding:"8px 13px",borderRadius:30,background:p.status==="approved"?"#e5f5eb":"#fff3db",color:p.status==="approved"?"#17633d":"#93651c",fontWeight:800}}>{p.status.toUpperCase()}</span>
    </header>
    {p.status!=="approved" ? <section style={{padding:22,borderRadius:16,background:"#fff8e9",border:"1px solid #f0dfb8"}}><b>Your application is under review.</b><p style={{marginBottom:0}}>Admin will contact you, discuss the partnership and set your commission rate before activating your referral link.</p></section> : <>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
        {[["Referred Students",s.students||0],["Premium Purchases",s.premiumSales||0],["Total Commission",money(s.earnedPaise)],["Pending Commission",money(s.pendingPaise)],["Paid Commission",money(s.paidPaise)]].map(([label,value])=><article key={String(label)} style={{padding:18,border:"1px solid #e0e7ef",borderRadius:16,background:"#fff"}}><small style={{color:"#68788a"}}>{label}</small><div style={{fontSize:26,fontWeight:850,marginTop:8}}>{value}</div></article>)}
      </section>
      <section style={{marginTop:18,padding:20,borderRadius:16,background:"#f5f8fc",border:"1px solid #dbe4ee"}}>
        <b>Your Referral Link</b><p style={{wordBreak:"break-all",color:"#536579"}}>{link}</p>
        <button onClick={()=>navigator.clipboard.writeText(link)} style={{padding:"11px 16px",background:"#173e68",color:"#fff",border:0,borderRadius:9,fontWeight:800}}>Copy Referral Link</button>
        <p style={{marginBottom:0,color:"#65768a",fontSize:13}}>Your commission rate: <b>{p.commission_rate}%</b> · Commission is earned only on successful Premium purchases.</p>
      </section>
      <section style={{marginTop:22,padding:20,border:"1px solid #e0e7ef",borderRadius:16,background:"#fff"}}>
        <h2 style={{marginTop:0}}>Referred Students</h2>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr><th style={{padding:10}}>Student</th><th style={{padding:10}}>Student Code</th><th style={{padding:10}}>Joined</th></tr></thead><tbody>{data.referrals.map((r:any)=><tr key={r.id}><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{r.profiles?.full_name||"Student"}</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{r.profiles?.student_code||"—"}</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td></tr>)}{!data.referrals.length&&<tr><td colSpan={3} style={{padding:12,color:"#68788a"}}>No referred students yet.</td></tr>}</tbody></table></div>
      </section>
      <section style={{marginTop:22,padding:20,border:"1px solid #e0e7ef",borderRadius:16,background:"#fff"}}>
        <h2 style={{marginTop:0}}>Commission History</h2>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",textAlign:"left"}}><thead><tr><th style={{padding:10}}>Date</th><th style={{padding:10}}>Premium Amount</th><th style={{padding:10}}>Rate</th><th style={{padding:10}}>Commission</th><th style={{padding:10}}>Status</th></tr></thead><tbody>{data.commissions.map((c:any)=><tr key={c.id}><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{new Date(c.created_at).toLocaleDateString("en-IN")}</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{money(c.amount_paise)}</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{c.commission_rate}%</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{money(c.commission_paise)}</td><td style={{padding:10,borderTop:"1px solid #edf1f5"}}>{c.status}</td></tr>)}{!data.commissions.length&&<tr><td colSpan={5} style={{padding:12,color:"#68788a"}}>No Premium commission yet.</td></tr>}</tbody></table></div>
      </section>
    </>}
    {message && <p role="status" style={{color:"#9a4b16"}}>{message}</p>}
  </main>;
}
