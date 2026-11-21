"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const cards = [
  ["📝", "Mock Tests", "Practice daily and full mock papers", "/tests"],
  ["📢", "Job Alerts", "Recruitment updates and apply links", "/job-alerts"],
  ["📄", "Previous Papers", "Prepare with previous exam papers", "/previous-papers"],
  ["📈", "Performance", "View your score and accuracy", "/performance"],
  ["🕘", "Test History", "Review your previous attempts", "/test-history"],
  ["⭐", "Bookmarks", "Return to saved study items", "/bookmarks"],
  ["👤", "My Profile", "Manage your student details", "/profile"],
];

export default function Dashboard() {
  const [name,setName]=useState("Student");
  const [signedIn,setSignedIn]=useState(false);
  const [attempts,setAttempts]=useState(0);
  useEffect(()=>{
    let active=true;
    (async()=>{
      const sb=supabaseBrowser();
      if(!sb)return;
      const {data:{user}}=await sb.auth.getUser();
      if(!active)return;
      if(user){
        setSignedIn(true);
        const {data}=await sb.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
        if(active && data?.full_name)setName(data.full_name);
        const {count}=await sb.from("test_attempts").select("id",{count:"exact",head:true}).eq("user_id",user.id);
        if(active)setAttempts(count||0);
      }
    })();
    return()=>{active=false};
  },[]);
  return <div className="mu-dashboard">
    <section className="mu-dashboard-welcome">
      <span className="mu-kicker">MISSION UNIFORM OP · STUDENT PORTAL</span>
      <h1>Welcome back, {name}!</h1>
      <p>Your preparation journey starts with one focused step today.</p>
      <div className="mu-dashboard-stats">
        <div><b>{signedIn?attempts:"—"}</b><span>Test attempts</span></div>
        <div><b>{signedIn?"Active":"—"}</b><span>Account status</span></div>
        <div><b>3</b><span>Study languages</span></div>
      </div>
    </section>
    <section className="mu-dash-section">
      <div className="mu-section-title"><div><span className="mu-kicker">YOUR WORKSPACE</span><h2>What would you like to do?</h2></div></div>
      <div className="mu-feature-grid">
        {cards.map(([icon,title,desc,href])=><Link className="mu-feature-card" href={href} key={href}>
          <span className="mu-feature-icon blue">{icon}</span><span className="mu-feature-title">{title}</span>
          <span className="mu-feature-desc">{desc}</span><span className="mu-feature-go">Open section <b>↗</b></span>
        </Link>)}
      </div>
    </section>
    <section className="mu-quick-strip"><div><span className="mu-kicker">DAILY PRACTICE</span><h2>Ready for today's mock test?</h2><p>Attempt a paper and analyse your answers afterwards.</p></div><Link className="mu-btn mu-btn-gold" href="/tests">Explore Mock Tests →</Link></section>
  </div>
}
