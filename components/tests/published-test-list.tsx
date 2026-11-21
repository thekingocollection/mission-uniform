"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Paper = { id:string; title:string; description:string|null; test_type:string; question_mode?:string; subject?:{name_en?:string|null;name_hi?:string|null}|null; duration_minutes:number; total_questions:number; marks_per_question:number; negative_marking:number; is_previous_year?:boolean; exam_year?:number|null; exam_name?:string|null; session_label?:string|null; source_label?:string|null };

export default function PublishedTestList({ testType }: { testType?: string }) {
  const [tests,setTests]=useState<Paper[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("all");
  useEffect(()=>{
    let active=true;
    fetch("/api/tests"+(testType?"?type="+encodeURIComponent(testType):""))
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Tests load nahi hue.");return d;})
      .then(d=>{if(active){setTests(d.tests||[]);setError("");}})
      .catch(e=>{if(active)setError(e.message||"Tests load nahi hue.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[testType]);
  // The Mock Tests catalogue is reserved for papers explicitly published by the admin.\n  // Question-bank random subject practice is available only from its separate navigation page.\n  const listedTests=tests.filter(t=>t.question_mode!=="subject_random");\n  const types=[["all","All"],["daily","Daily"],["subject","Subject"],["chapter","Chapter"],["full","Full Mock"],["grand","Grand Test"],["previous_year","Previous Year"]];\n  const visible=filter==="all"?listedTests:filter==="previous_year"?listedTests.filter(t=>t.is_previous_year):listedTests.filter(t=>t.test_type===filter);
  return <div className="mu-test-list">
    {!testType && <div className="mu-filter-row" aria-label="Filter tests">{types.map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={filter===v?"active":""}>{l}</button>)}</div>}
    {loading&&<section className="panel">Loading published tests…</section>}
    {!loading&&error&&<section className="panel"><h3>Tests load nahi ho paye</h3><p>{error}</p><button className="btn primary" onClick={()=>window.location.reload()}>Try again</button></section>}
    {!loading&&!error&&visible.length===0&&<section className="panel"><h3>No tests available</h3><p>Abhi is category mein test publish nahi hua hai.</p></section>}
    {!loading&&!error&&visible.length>0&&<div className="mu-test-grid">{visible.map(t=><article className="mu-test-card" key={t.id}>
      <span className="mu-test-type">{t.is_previous_year?"PREVIOUS YEAR QUESTIONS":t.question_mode==="subject_random"?"SUBJECT RANDOM PRACTICE":t.test_type.replaceAll("_"," ").toUpperCase()}</span>
      <h3>{t.question_mode==="subject_random"?(t.subject?.name_en||t.subject?.name_hi||t.title):t.title}</h3>{t.is_previous_year&&<p className="mu-previous-meta">{t.exam_name||"Previous Year Paper"} · {t.exam_year}{t.session_label?" · "+t.session_label:""}</p>}<p>{t.question_mode==="subject_random"?"Har attempt mein question bank se naye random 30 questions milenge.":t.description||"Odisha Police exam practice paper."}</p>
      <div className="mu-test-stats"><span><b>{t.total_questions}</b>Questions</span><span><b>{t.duration_minutes} min</b>Duration</span><span><b>{t.marks_per_question}</b>Marks / Q</span></div>
      <small>Negative marking: {t.negative_marking}</small>{t.is_previous_year&&<small className="mu-paper-source">{t.source_label||"Previous Year Questions"} · Admin verified</small>}
      <Link className="mu-btn mu-btn-gold mu-test-start" href={"/tests/paper/"+t.id}>Start Test <b>→</b></Link>
    </article>)}</div>}
  </div>;
}
