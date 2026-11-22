"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);\n  const [email, setEmail] = useState("");\n  const [emailVerified, setEmailVerified] = useState(false);\n  const [verifyBusy, setVerifyBusy] = useState(false);\n  const [verifyMessage, setVerifyMessage] = useState("");

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
      setAttempts(count || 0);
    })().catch(() => {
      if (active) setName("Student");
    });
    return () => { active = false; };
  }, []);

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
      {!emailVerified && <section role="status" style={{margin:"18px auto",maxWidth:1100,padding:"16px 18px",border:"1px solid #e7d8ad",borderRadius:12,background:"#fffaf0",color:"#57451e",display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div><strong>Email verification pending</strong><p style={{margin:"5px 0 0",fontSize:13}}> {email ? "We will send a secure verification link to " + email + "." : "Verify your email whenever convenient."} You can continue studying and taking every mock test.</p>{verifyMessage && <small>{verifyMessage}</small>}</div><button type="button" onClick={sendVerification} disabled={verifyBusy} style={{padding:"10px 15px",border:0,borderRadius:8,background:"#173b50",color:"#fff",fontWeight:700,cursor:"pointer"}}>{verifyBusy ? "Sending…" : "Verify Email"}</button></section>}\n      {emailVerified && <p role="status" style={{margin:"12px auto",maxWidth:1100,color:"#17613b"}}>✓ Email verified</p>}\n      <PremiumTrialBanner />
      <section className="mu-student-quote">
        <span>AAJ KA SANKALP</span>
        <h2>“Selection ek din mein nahi hota, lekin har din ki taiyari se zaroor hoti hai.”</h2>
        <p>Focus rakhiye. Practice kijiye. Apne aap par bharosa rakhiye.</p>
      </section>
      <p className="mu-student-signoff">MISSION UNIFORM OP <span>·</span> Your Dream. Your Uniform. Your Mission.</p>
    </div>
  );
}
