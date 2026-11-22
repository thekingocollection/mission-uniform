"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [studyInsights, setStudyInsights] = useState<{weakAreas:any[];subjectPace:any[]}|null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in to view your student dashboard.");
      const [{ data: profile }, { count }] = await Promise.all([
        sb.from("profiles").select("full_name,email,email_verified").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (!active) return;
      if (profile?.full_name) setName(profile.full_name);
      setEmail(profile?.email || user.email || "");
      setEmailVerified(!!profile?.email_verified);
      setAttempts(count || 0);
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData.session) {
        const insightResponse = await fetch("/api/study-insights", { headers: { Authorization: "Bearer " + sessionData.session.access_token }, cache: "no-store" });
        if (insightResponse.ok) {
          const insightData = await insightResponse.json();
          if (active) setStudyInsights({ weakAreas: insightData.weakAreas || [], subjectPace: insightData.subjectPace || [] });
        }
      }
    })().catch(() => {
      if (active) setName("Student");
    });
    return () => { active = false; };
  }, []);

  const sendVerification = async () => {
    setVerifyBusy(true);
    setVerifyMessage("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in again to verify your email.");
      const response = await fetch("/api/email-verification/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send the verification email.");
      setVerifyMessage("Verification link sent. Please check your inbox.");
    } catch (error) {
      setVerifyMessage(error instanceof Error ? error.message : "Could not send the verification email.");
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div className="mu-student-home">
      <section className="mu-student-hero">
        <div className="mu-student-hero-copy">
          <span className="mu-kicker">MISSION UNIFORM OP · YOUR PREPARATION ZONE</span>
          <p className="mu-student-greeting">WELCOME BACK, {name.toUpperCase()}</p>
          <h1>Vardi ka sapna hai,<br /><em>toh haar maanna mana hai.</em></h1>
          <p className="mu-student-hero-lead">Har din ki mehnat aapko apne lakshya ke ek kadam kareeb le jaati hai. Aaj khud ko kal se behtar banaiye.</p>
          <div className="mu-student-hero-stats">
            <div><b>{attempts}</b><span>Tests attempted</span></div>
            <div><b>FREE</b><span>Practice for every student</span></div>
          </div>
        </div>
        <div className="mu-student-field-activity" aria-hidden="true">
          <span className="mu-student-radar-ring ring-one" />
          <span className="mu-student-radar-ring ring-two" />
          <span className="mu-student-flight-path" />
          <span className="mu-student-flight">✈</span>
          <span className="mu-student-field-label">FIELD STATUS · ACTIVE</span>
        </div>
        <div className="mu-student-emblem" aria-hidden="true">
          <div className="mu-student-emblem-ring"><span>DISCIPLINE</span><b>MU</b><span>DEDICATION</span></div>
          <small>EK LAKSHYA · EK JUNOON</small>
        </div>
      </section>
      <section className="mu-odisha-mission-strip">
        <div className="mu-odisha-map-art" aria-label="Stylized Odisha map illustration">
          <svg viewBox="0 0 210 230" role="img" aria-hidden="true">
            <defs><linearGradient id="odishaGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3d98e"/><stop offset="1" stopColor="#c89b38"/></linearGradient></defs>
            <path d="M79 8 L105 17 L121 12 L138 28 L157 33 L165 52 L185 62 L176 83 L188 103 L171 119 L178 141 L159 154 L153 174 L132 180 L119 203 L99 195 L82 215 L67 197 L47 194 L40 175 L21 166 L30 145 L16 128 L29 109 L22 89 L40 76 L42 54 L61 45 L62 25 Z" fill="url(#odishaGold)" stroke="#f8e9bd" strokeWidth="3" strokeLinejoin="round"/>
            <path d="M51 70 L91 80 L132 60 M35 116 L81 122 L151 102 M48 159 L93 147 L159 153 M83 28 L91 80 L81 122 L93 147 L82 197 M132 60 L121 103 L130 145 L119 190" fill="none" stroke="#8d6824" strokeOpacity=".45" strokeWidth="1.5" strokeDasharray="3 4"/>
            <circle cx="109" cy="110" r="5" fill="#173b50" stroke="#fff" strokeWidth="2"/><circle cx="109" cy="110" r="12" fill="none" stroke="#173b50" strokeOpacity=".55"/>
            <circle cx="71" cy="151" r="3.5" fill="#173b50"/><circle cx="147" cy="76" r="3.5" fill="#173b50"/><circle cx="132" cy="167" r="3.5" fill="#173b50"/>
          </svg>
        </div>
        <div className="mu-odisha-mission-copy">
          <span>ODISHA · THE LAND OF COURAGE</span>
          <h2>Har district se ek naya sapna. Har cadet ka ek hi mission.</h2>
          <p>Odisha Police ki taiyari ko discipline, practice aur consistency ke saath aage badhaiye. Apne district se shuru kijiye — apni manzil tak pahunchiye.</p>
          <div className="mu-odisha-pills"><b>ଭୁବନେଶ୍ୱର</b><b>କଟକ</b><b>ସମ୍ବଲପୁର</b><b>ବଲାଙ୍ଗିର</b><b>ବ୍ରହ୍ମପୁର</b></div>
        </div>
      </section>
      {!emailVerified && <section role="status" style={{margin:"18px auto",maxWidth:1100,padding:"16px 18px",border:"1px solid #e7d8ad",borderRadius:12,background:"#fffaf0",color:"#57451e",display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div><strong>Email verification pending</strong><p style={{margin:"5px 0 0",fontSize:13}}> {email ? "We will send a secure verification link to " + email + "." : "Verify your email whenever convenient."} You can continue studying and taking every mock test.</p>{verifyMessage && <small>{verifyMessage}</small>}</div><button type="button" onClick={sendVerification} disabled={verifyBusy} style={{padding:"10px 15px",border:0,borderRadius:8,background:"#173b50",color:"#fff",fontWeight:700,cursor:"pointer"}}>{verifyBusy ? "Sending…" : "Verify Email"}</button></section>}
      {emailVerified && <p role="status" style={{margin:"12px auto",maxWidth:1100,color:"#17613b"}}>✓ Email verified</p>}
      <nav className="mu-dashboard-shortcuts" aria-label="Student shortcuts">
        <a href="/tests"><span>📝</span><b>Mock Tests</b><small>Practice now</small></a>
        <a href="/test-history"><span>📊</span><b>Test History</b><small>Review progress</small></a>
        <a href="/notifications"><span>🔔</span><b>Notifications</b><small>Latest updates</small></a>
      </nav>
      {studyInsights && <section style={{margin:"20px auto",maxWidth:1100,padding:20,border:"1px solid #d8e1e8",borderRadius:14,background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <div><span style={{fontSize:11,fontWeight:800,letterSpacing:1,color:"#9a742b"}}>FREE · NO AI API COST</span><h2 style={{margin:"5px 0",color:"#173b50"}}>Smart Study Insights</h2><p style={{margin:0,color:"#64748b",fontSize:13}}>Aapke mock test results ke basis par preparation guidance.</p></div>
          <a href="/leaderboard" style={{color:"#173b50",fontWeight:700}}>Full analysis →</a>
        </div>
        {studyInsights.weakAreas.length ? <div style={{marginTop:16}}><b>Improve these chapters</b><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginTop:9}}>{studyInsights.weakAreas.slice(0,4).map((item:any,i:number)=><div key={i} style={{padding:12,borderRadius:10,background:"#fff8ed",border:"1px solid #f0dfbf"}}><b>{item.chapter}</b><p style={{margin:"4px 0",fontSize:12,color:"#64748b"}}>{item.subject}</p><strong style={{color:"#9a4d20"}}>{item.accuracy}% accuracy</strong><small style={{display:"block",color:"#64748b"}}>{item.attempted} questions attempted</small></div>)}</div></div>
        : <p style={{marginTop:14,color:"#64748b"}}>Abhi weak chapter identify nahi hua. Kam se kam 2 questions per chapter attempt karein; phir analysis dikhne lagega.</p>}
        {studyInsights.subjectPace.length>0 && <p style={{margin:"14px 0 0",fontSize:13,color:"#475569"}}><b>Speed tip:</b> {studyInsights.subjectPace[0].subject} mein average {studyInsights.subjectPace[0].avgSecondsPerQuestion} seconds/question lag rahe hain. Regular timed practice karein.</p>}
      </section>}
      <PremiumTrialBanner />
      <section className="mu-student-quote">
        <span>AAJ KA SANKALP</span>
        <h2>“Selection ek din mein nahi hota, lekin har din ki taiyari se zaroor hoti hai.”</h2>
        <p>Focus rakhiye. Practice kijiye. Apne aap par bharosa rakhiye.</p>
      </section>
      <p className="mu-student-signoff">MISSION UNIFORM OP <span>·</span> Your Dream. Your Uniform. Your Mission.</p>
    </div>
  );
}
