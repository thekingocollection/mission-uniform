"use client";

import { useEffect, useMemo, useState } from "react";

type Subject = { id:string; subject_id:string; name_en:string|null; name_hi:string|null; verified_questions:number };

const QUESTION_PRESETS = [10, 20, 30, 50, 100];

export default function SubjectMockTestPage() {
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [subjectId,setSubjectId]=useState("");
  const [count,setCount]=useState(30);
  const [loading,setLoading]=useState(true);
  const [starting,setStarting]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/subject-practice").then(async r=>{
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||"Subjects load nahi hue.");
      if(!active)return;
      const available=(data.subjects||[]) as Subject[];
      setSubjects(available);
      const requested=new URLSearchParams(window.location.search).get("subject");
      const initial=available.find(s=>s.subject_id===requested)||available[0];
      if(initial){setSubjectId(initial.subject_id);setCount(Math.min(30,initial.verified_questions));}
      setLoading(false);
    }).catch(e=>{if(active){setError(e.message);setLoading(false);}});
    return ()=>{active=false;};
  },[]);

  const selected=useMemo(()=>subjects.find(s=>s.subject_id===subjectId),[subjects,subjectId]);
  const maxCount=Math.min(100,selected?.verified_questions||0);

  useEffect(()=>{
    if(selected) setCount(current=>Math.min(Math.max(1,current),Math.max(1,selected.verified_questions)));
  },[selected?.subject_id,selected?.verified_questions]);

  function chooseSubject(id:string) {
    setSubjectId(id);
    const next=subjects.find(s=>s.subject_id===id);
    if(next) setCount(Math.min(30,next.verified_questions));
  }

  function start() {
    if(!selected||count>maxCount||count<1||!Number.isInteger(count))return;
    setStarting(true);
    window.location.href="/tests/paper/"+selected.id+"?count="+count;
  }

  return <main className="content-wrap mu-subject-practice">
    <section className="mu-subject-hero">
      <div className="mu-subject-hero-copy">
        <span className="mu-subject-kicker"><i/> MISSION UNIFORM OP · TRAINING COMMAND</span>
        <h1>Subject Wise <em>Mock Test</em></h1>
        <p>Apna subject chuniye, questions ki sankhya set kijiye aur exam-style practice shuru kijiye.</p>
        <div className="mu-subject-hero-tags"><span>✦ RANDOM QUESTIONS</span><span>✓ VERIFIED SET</span><span>◷ SELF PACED</span></div>
      </div>
      <div className="mu-subject-hero-mark" aria-hidden="true">
        <div className="mu-subject-orbit orbit-a"/><div className="mu-subject-orbit orbit-b"/>
        <div className="mu-subject-crest"><span>MU</span><b>✦</b><small>TRAINING</small></div>
      </div>
      <div className="mu-subject-hero-foot"><span>INDIVIDUAL SUBJECT TRAINING</span><span>DISCIPLINE · PRACTICE · SUCCESS</span></div>
    </section>

    <section className="mu-subject-section">
      <div className="mu-subject-section-head"><div><span className="mu-subject-step">01 / SELECT YOUR SUBJECT</span><h2>Choose Training Module</h2><p>Jis subject ki practice karni hai, us card ko select karein.</p></div><span className="mu-subject-section-icon">▦</span></div>

      {loading?<div className="mu-subject-state"><span className="mu-subject-loader"/> Subjects load ho rahe hain…</div>
      :error?<div className="mu-subject-state is-error">{error}</div>
      :subjects.length===0?<div className="mu-subject-state">Abhi practice ke liye subjects available nahi hain. Admin se verified questions add karwayein.</div>
      :<div className="mu-subject-grid">
        {subjects.map((s,index)=>{
          const active=s.subject_id===subjectId;
          const icons=["◈","▤","✥","⌘","◎","◇","✦","▧"];
          return <button type="button" key={s.subject_id} aria-pressed={active} className={`mu-subject-card ${active?"is-selected":""}`} onClick={()=>chooseSubject(s.subject_id)}>
            <span className="mu-subject-card-top"><i>{icons[index%icons.length]}</i><small>MODULE {String(index+1).padStart(2,"0")}</small></span>
            <b>{s.name_en||s.name_hi||"Subject"}</b>
            {s.name_hi&&s.name_en&&<span className="mu-subject-local-name">{s.name_hi}</span>}
            <span className="mu-subject-card-bottom">{active?<><strong>SELECTED</strong><i>✓</i></>:<><span>SELECT MODULE</span><i>↗</i></>}</span>
          </button>;
        })}
      </div>}
    </section>

    {selected&&<section className="mu-subject-config">
      <div className="mu-subject-config-head"><div><span className="mu-subject-step">02 / CONFIGURE YOUR TEST</span><h2>Set Your Practice</h2><p>Question count select karein. Maximum 100 questions tak choose kar sakte hain, agar available hon.</p></div><div className="mu-subject-selected-pill"><span>SELECTED SUBJECT</span><b>{selected.name_en||selected.name_hi}</b></div></div>
      {maxCount===0?<div className="mu-subject-state">Is subject mein abhi practice questions available nahi hain.</div>:<>
        <div className="mu-subject-count-label"><b>Number of Questions</b><span>Choose a test size</span></div>
        <div className="mu-subject-count-options">
          {QUESTION_PRESETS.map(n=><button type="button" key={n} disabled={n>maxCount} aria-pressed={count===n} className={count===n?"active":""} onClick={()=>setCount(n)}><b>{n}</b><small>QUESTIONS</small></button>)}
          <label className="mu-subject-custom-count"><span>Custom</span><input type="number" min={1} max={maxCount} value={count} onChange={e=>setCount(Number(e.target.value))} aria-label="Custom question count"/></label>
        </div>
        <div className="mu-subject-test-summary">
          <div className="mu-subject-summary-symbol">✦</div>
          <div className="mu-subject-summary-copy"><small>YOUR TEST IS READY</small><b>{selected.name_en||selected.name_hi} Practice</b><span>{count} questions · Random order · Fresh set on every attempt</span></div>
          <div className="mu-subject-summary-count"><b>{count}</b><small>QUESTIONS</small></div>
        </div>
        <button className="mu-subject-start" disabled={starting||!Number.isInteger(count)||count<1||count>maxCount} onClick={start}><span>{starting?"PREPARING YOUR TEST…":"START SUBJECT MOCK TEST"}</span><b>→</b></button>
        <p className="mu-subject-note">ⓘ Har attempt mein random verified questions milenge. Ek test ke andar duplicate questions nahi honge.</p>
      </>}
    </section>}
  </main>;
}
