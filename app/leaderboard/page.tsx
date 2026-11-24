"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabaseBrowser} from "@/lib/supabase-browser";

type Entry={user_id:string;name:string;points:number;tests:number;accuracy:number;rank:number};
type WeakArea={subject:string;chapter:string;attempted:number;correct:number;wrong:number;skipped:number;accuracy:number};
type Pace={subject:string;avgSecondsPerQuestion:number;tests:number};

export default function Leaderboard(){
 const [rows,R]=useState<Entry[]>([]),[me,M]=useState<Entry|null>(null),[weak,W]=useState<WeakArea[]>([]),[pace,P]=useState<Pace[]>([]);
 const [loading,L]=useState(true),[error,E]=useState("");
 useEffect(()=>{let live=true;(async()=>{try{const sb=supabaseBrowser();if(!sb)throw Error("Student portal unavailable.");const {data:{session}}=await sb.auth.getSession();if(!session)throw Error("Please login to view leaderboard.");const res=await fetch("/api/leaderboard",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});const d=await res.json();if(!res.ok)throw Error(d.error||"Unable to load leaderboard.");if(live){R(d.top||[]);M(d.me||null);W(d.weakAreas||[]);P(d.subjectPace||[]);}}catch(e:any){if(live)E(e.message||"Unable to load leaderboard.");}finally{if(live)L(false);}})();return()=>{live=false}},[]);
 return <div className="mu-leaderboard">
  <section className="mu-leader-hero"><span>MISSION UNIFORM OP · CADET HONOUR ROLL</span><h1>Rise Through <em>Dedication.</em></h1><p>Every submitted mock test is a step forward. Compete fairly, learn from your performance and improve your rank.</p><div className="mu-leader-hero-foot"><b>🏅 STUDENT LEADERBOARD</b><span>Best score per test · Repeat attempts do not add extra points</span></div></section>
  {me&&<section className="mu-my-rank">{[["YOUR RANK","#"+me.rank],["POINTS",me.points],["TESTS SCORED",me.tests],["ACCURACY",me.accuracy+"%"]].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b>{k==="YOUR RANK"&&<span>{me.name}</span>}</div>)}</section>}
  <section className="mu-leader-card mu-performance-card"><header><div><span>YOUR PERSONAL ANALYSIS</span><h2>Find Your Weak Chapters</h2><p>Apne mock tests ke answers se pata karein kis chapter par aur practice chahiye.</p></div><Link href="/subject-mock-test">Practise Subjects ↗</Link></header>
   {loading?<div className="mu-leader-empty">Analysing your mock test performance…</div>:error?<div className="mu-leader-empty">Performance analysis load nahi ho paya.</div>:!weak.length?<div className="mu-leader-empty"><b>Abhi koi weak chapter identify nahi hua.</b><p>Kam se kam 2 questions attempt karke mock test submit karein. Analysis aapke actual answers se update hoga.</p></div>:<div className="mu-weak-grid">{weak.map((w,i)=><article className="mu-weak-item" key={w.subject+w.chapter}><div className="mu-weak-top"><span>{w.subject}</span><b>{w.accuracy}% accuracy</b></div><h3>{w.chapter}</h3><div className="mu-weak-meter"><i style={{width:w.accuracy+"%"}}/></div><p>{w.attempted} questions · {w.correct} correct · {w.wrong} wrong · {w.skipped} skipped</p><small>{w.accuracy<40?"High priority · Revise this chapter first":"Needs more practice · Keep improving"}</small><Link href="/subject-mock-test">Practise subject →</Link></article>)}</div>}
  </section>
  <section className="mu-leader-card mu-performance-card"><header><div><span>TIME MANAGEMENT</span><h2>Subject-wise Speed</h2><p>Submitted test ke total time se average seconds per question nikala gaya hai.</p></div></header>
   {loading?<div className="mu-leader-empty">Calculating test pace…</div>:!pace.length?<div className="mu-leader-empty">Time analysis ke liye submitted mock tests chahiye.</div>:<div className="mu-pace-list">{pace.map(p=><div className="mu-pace-row" key={p.subject}><div><b>{p.subject}</b><small>{p.tests} submitted test(s)</small></div><strong>{p.avgSecondsPerQuestion}s <small>/ question</small></strong><span className={p.avgSecondsPerQuestion>60?"is-slow":"is-steady"}>{p.avgSecondsPerQuestion>60?"Work on speed":"Good pace"}</span></div>)}</div>}
   <p className="mu-leader-note">Note: Abhi system poore subject test ka average time calculate karta hai, har individual question/chapter ka exact time nahi.</p>
  </section>
  <section className="mu-leader-card"><header><div><span>TOP CADETS</span><h2>Leaderboard Rankings</h2><p>Only submitted mock tests count. Best score for each test is used.</p></div><Link href="/tests">Practice Now ↗</Link></header>
   {loading?<div className="mu-leader-empty">Calculating student rankings…</div>:error?<div className="mu-leader-empty">{error}</div>:!rows.length?<div className="mu-leader-empty"><b>Your rank starts with your first test.</b><p>Attempt and submit a mock test to appear here. Keep practising!</p><Link href="/tests">Start Your First Mock Test →</Link></div>:<>
    <div className="mu-leader-podium">{rows.filter(r=>r.rank<=3).sort((a,b)=>a.rank-b.rank).map(r=><article key={r.user_id} className={`mu-podium-card podium-${r.rank} ${me?.user_id===r.user_id?"is-me":""}`}><span>{["🥇","🥈","🥉"][r.rank-1]}</span><small>RANK #{r.rank}</small><b>{r.name}</b><strong>{r.points} <em>PTS</em></strong><i>{r.accuracy}% accuracy</i></article>)}</div>
    <div className="mu-leader-table-wrap"><table className="mu-leader-table"><thead><tr><th>RANK</th><th>STUDENT CADET</th><th>POINTS</th><th>TESTS</th><th>ACCURACY</th></tr></thead><tbody>{rows.map(r=><tr key={r.user_id} className={me?.user_id===r.user_id?"is-me":""}><td data-label="Rank"><b className="mu-rank-number">{r.rank<=3?["🥇","🥈","🥉"][r.rank-1]:"#"+r.rank}</b></td><td data-label="Student Cadet"><strong>{r.name}</strong>{me?.user_id===r.user_id&&<small>YOU</small>}</td><td data-label="Points">{r.points}</td><td data-label="Tests">{r.tests}</td><td data-label="Accuracy">{r.accuracy}%</td></tr>)}</tbody></table></div>
   </>}<p className="mu-leader-note">Fair play: only the best submitted score per test is counted. Your private email and mobile number are never shown.</p>
  </section>
 </div>;
}
