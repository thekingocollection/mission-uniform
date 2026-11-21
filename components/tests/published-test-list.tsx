"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
export default function PublishedTestList({testType}:{testType?:string}){
 const [tests,setTests]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{const u="/api/tests"+(testType?`?type=${testType}`:"");fetch(u).then(r=>r.json()).then(d=>{if(d.error)setError(d.error);setTests(d.tests??[])}).catch(()=>setError("Tests load nahi ho paye.")).finally(()=>setLoading(false))},[testType]);
 if(loading)return <section className="panel">Loading published tests…</section>;
 return <section className="panel"><h1>{testType?`${testType[0].toUpperCase()+testType.slice(1)} Tests`:"Available Mock Tests"}</h1>{error&&<p>{error}</p>}{tests.length===0?<p>Abhi is category me koi published test nahi hai. Admin se test publish karwayein.</p>:tests.map(t=><article className="review-item" key={t.id}><h3>{t.title}</h3><p>{t.description} · {t.duration_minutes} minutes · {t.total_questions} questions</p><Link className="btn primary" href={`/tests/paper/${t.id}`}>Start Test</Link></article>)}</section>
}
