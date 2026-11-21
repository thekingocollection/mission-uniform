"use client";

import { useEffect, useMemo, useState } from "react";

type Subject = { id:string; subject_id:string; name_en:string|null; name_hi:string|null; verified_questions:number };

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
      setSubjects(data.subjects||[]);
      const requested=new URLSearchParams(window.location.search).get("subject");
      const initial=(data.subjects||[]).find((s:Subject)=>s.subject_id===requested)||(data.subjects||[])[0];
      if(initial){setSubjectId(initial.subject_id);setCount(Math.min(30,initial.verified_questions));}
      setLoading(false);
    }).catch(e=>{if(active){setError(e.message);setLoading(false);}});
    return ()=>{active=false;};
  },[]);

  const selected=useMemo(()=>subjects.find(s=>s.subject_id===subjectId),[subjects,subjectId]);
  useEffect(()=>{
    if(selected&&count>selected.verified_questions) setCount(selected.verified_questions);
  },[selected?.subject_id,selected?.verified_questions]);

  function start() {
    if(!selected||count>selected.verified_questions||count<1)return;
    setStarting(true);
    window.location.href="/tests/paper/"+selected.id+"?count="+count;
  }

  return <main className="content-wrap">
    <section className="mu-parade-banner" aria-label="Indian flag parade animation">
      <div className="mu-parade-copy">
        <span className="mu-parade-kicker">MISSION UNIFORM OP · PARADE GROUND</span>
        <h2>March towards your uniform.</h2>
        <p>Har practice ek kadam, har mock test manzil ke aur kareeb. Jai Hind!</p>
        <span className="mu-parade-chip">🇮🇳 DISCIPLINE · PRACTICE · PRIDE</span>
      </div>
      <div className="mu-parade-stage" aria-hidden="true">
        <div className="mu-parade-track">
          {Array.from({length:5},(_,i)=><div className={"mu-parade-soldier mu-parade-soldier-"+i} key={i}>
            {i===0&&<div className="mu-parade-flag"><span>☸</span></div>}
            <svg viewBox="0 0 56 116" xmlns="http://www.w3.org/2000/svg" role="presentation">
              <path d="M15 18 L18 8 H38 L41 18 Z" fill="#374737"/>
              <rect x="19" y="18" width="18" height="5" rx="2" fill="#182a2c"/>
              <circle cx="28" cy="30" r="10" fill="#a88b68"/>
              <path d="M15 42 Q28 34 41 42 L45 74 H11 Z" fill="#536849"/>
              <path d="M18 44 L9 70 L15 74 L26 51 M38 44 L47 70 L41 74 L30 51" fill="#445b40"/>
              <path d="M18 73 L15 102 L22 106 L30 77 L35 105 L43 103 L39 73 Z" fill="#34483b"/>
              <path d="M15 101 L24 103 L24 113 H10 Z M34 103 L43 100 L48 113 H34 Z" fill="#182a2c"/>
              <path d="M14 71 H42" stroke="#c5a36c" strokeWidth="3"/>
            </svg>
          </div>)}
        </div>
      </div>
      <div className="mu-parade-ground" aria-hidden="true" />
    </section>

    <section className="panel test-intro">
      <span className="eyebrow">MISSION UNIFORM OP · CUSTOM PRACTICE</span>
      <h1>Apna Random Mock Test Banaiye</h1>
      <p>Subject aur question count chuniye. Aapko question bank se randomly selected verified questions milenge.</p>
      {loading?<p>Subjects load ho rahe hain…</p>:error?<p className="bulk-message">{error}</p>:subjects.length===0?<p>Abhi kisi subject mein verified questions available nahi hain.</p>:<>
        <label className="field-label" htmlFor="subject-choice">Select Subject</label>
        <select id="subject-choice" className="form-control" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>
          {subjects.map(s=><option key={s.subject_id} value={s.subject_id}>{s.name_en||s.name_hi||"Subject"}</option>)}
        </select>
        <label className="field-label" htmlFor="question-count">How many questions?</label>
        <input id="question-count" className="form-control" type="number" min={1} max={Math.min(100,selected?.verified_questions||100)} value={count} onChange={e=>setCount(Number(e.target.value))} />
        <small className="muted">Apni practice ke liye question count select kijiye.</small>
        {selected&&<div className="test-result-grid">
          <div><b>{count}</b><span>Your test size</span></div>
          <div><b>{count}</b><span>Minutes</span></div>
          <div><b>Random</b><span>Question order</span></div>
        </div>}
        <p className="muted">Har attempt par naya random set milega. Duplicate questions ek hi test mein nahi aayenge.</p>
        <button className="btn primary" disabled={!selected||starting||!Number.isInteger(count)||count<1||count>100||count>selected.verified_questions} onClick={start}>{starting?"Starting Mock Test…":"Start Mock Test"}</button>
        {error&&<p className="bulk-message">{error}</p>}
      </>}
    </section>
  </main>;
}
