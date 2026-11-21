"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Subject = { id:string; subject_id:string; name_en:string|null; name_hi:string|null; verified_questions:number };
const choices=[10,20,30,50,100];

export default function SubjectMockTestPage() {
  const search=useSearchParams();
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
      const requested=search.get("subject");
      const initial=(data.subjects||[]).find((s:Subject)=>s.subject_id===requested)||(data.subjects||[])[0];
      if(initial){setSubjectId(initial.subject_id);setCount(Math.min(30,initial.verified_questions));}
      setLoading(false);
    }).catch(e=>{if(active){setError(e.message);setLoading(false);}});
    return ()=>{active=false;};
  },[search]);

  const selected=useMemo(()=>subjects.find(s=>s.subject_id===subjectId),[subjects,subjectId]);
  const availableCounts=selected?choices.filter(n=>n<=selected.verified_questions):[];

  useEffect(()=>{
    if(selected&&!availableCounts.includes(count)) setCount(availableCounts.at(-1)||selected.verified_questions);
  },[selected?.subject_id,selected?.verified_questions]);

  async function start() {
    if(!selected||count>selected.verified_questions||count<1)return;
    setStarting(true);setError("");
    try {
      const sb=supabaseBrowser();
      if(!sb)throw new Error("Supabase connection unavailable.");
      const {data:{session}}=await sb.auth.getSession();
      if(!session)throw new Error("Mock test start karne ke liye login karein.");
      const response=await fetch("/api/tests/"+selected.id+"/start",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({question_count:count})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Mock test start nahi hua.");
      window.location.href="/tests/paper/"+selected.id+"?count="+count;
    }catch(e:any){setError(e.message||"Mock test start nahi hua.");setStarting(false);}
  }

  return <main className="content-wrap">
    <section className="panel test-intro">
      <span className="eyebrow">MISSION UNIFORM OP · CUSTOM PRACTICE</span>
      <h1>Apna Random Mock Test Banaiye</h1>
      <p>Subject aur question count chuniye. Aapko question bank se randomly selected verified questions milenge.</p>
      {loading?<p>Subjects load ho rahe hain…</p>:error?<p className="bulk-message">{error}</p>:subjects.length===0?<p>Abhi kisi subject mein verified questions available nahi hain.</p>:<>
        <label className="field-label" htmlFor="subject-choice">Select Subject</label>
        <select id="subject-choice" className="form-control" value={subjectId} onChange={e=>setSubjectId(e.target.value)}>
          {subjects.map(s=><option key={s.subject_id} value={s.subject_id}>{s.name_en||s.name_hi||"Subject"} ({s.verified_questions} questions)</option>)}
        </select>
        <label className="field-label" htmlFor="question-count">How many questions?</label>
        <select id="question-count" className="form-control" value={count} onChange={e=>setCount(Number(e.target.value))}>
          {availableCounts.map(n=><option key={n} value={n}>{n} Questions</option>)}
          {selected&&selected.verified_questions<10?<option value={selected.verified_questions}>{selected.verified_questions} Questions (all available)</option>:null}
        </select>
        {selected&&<div className="test-result-grid">
          <div><b>{selected.verified_questions}</b><span>Verified in bank</span></div>
          <div><b>{count}</b><span>Your test size</span></div>
          <div><b>{count}</b><span>Minutes</span></div>
          <div><b>Random</b><span>Question order</span></div>
        </div>}
        <p className="muted">Har attempt par naya random set milega. Duplicate questions ek hi test mein nahi aayenge.</p>
        <button className="btn primary" disabled={!selected||starting||!count||count>selected.verified_questions} onClick={start}>{starting?"Starting Mock Test…":"Start Mock Test"}</button>
        {error&&<p className="bulk-message">{error}</p>}
      </>}
    </section>
  </main>;
}
