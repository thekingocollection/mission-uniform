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
