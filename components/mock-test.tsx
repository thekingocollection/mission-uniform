"use client";
import {useEffect,useMemo,useState} from "react";
import {demoQuestions} from "@/lib/data";
import {supabaseBrowser} from "@/lib/supabase-browser";
import Link from "next/link";

type Question={id:string;subject:string;q:string;en:string;opts:string[];answer:number;explain:string;isLive?:boolean};
export default function MockTest({title="Daily Mock Test",count=10,minutes=20,subject}:{title?:string;count?:number;minutes?:number;subject?:string}){
 const [questions,setQuestions]=useState<Question[]>([]);
 const [source,setSource]=useState<"loading"|"live"|"demo">("loading");
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [idx,setIdx]=useState(0); const [review,setReview]=useState<string[]>([]);
 const [seconds,setSeconds]=useState(minutes*60); const [submitted,setSubmitted]=useState(false);
 const [started,setStarted]=useState(false); const [saving,setSaving]=useState(false);
 const [attemptId,setAttemptId]=useState<string|null>(null); const [saveMessage,setSaveMessage]=useState(""); const [liveScore,setLiveScore]=useState<{score:number;total:number}|null>(null);
 const supabase=supabaseBrowser();
 useEffect(()=>{let active=true;(async()=>{
   if(supabase){
    let query=supabase.from("public_questions").select("id,question,question_od,options,difficulty,subject_name");if(subject)query=query.eq("subject_name",subject);const {data,error}=await query.limit(count);
    if(!error&&data?.length){
     const mapped=data.map((x:any)=>({id:x.id,subject:x.subject_name||"General",q:x.question,en:x.question_od||"",opts:Array.isArray(x.options)?x.options:[],answer:-1,explain:"Answer explanation will be shown after submission.",isLive:true}));
     if(active){setQuestions(mapped);setSource("live");}return;
    }
   }
   const fallback=(subject?demoQuestions.filter((x:any)=>x.subject===subject):demoQuestions).slice(0,count);
   if(active){setQuestions(fallback.map((x:any)=>({...x})));setSource("demo");}
  })();return()=>{active=false};
 },[count,subject]);
 const qs=questions; const q=qs[idx];
 const score=qs.reduce((n,x)=>n+(source==="live"?0:answers[x.id]===x.answer?1:0),0);
 const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
 async function submit(){
  if(saving)return;setSaving(true);
  if(source==="live"&&supabase){
   const {data,error}=await supabase.rpc("submit_mock_attempt",{p_title:title,p_answers:answers});
   if(!error&&data){setAttemptId(data.id);setLiveScore({score:data.score,total:data.total});setSaveMessage("Your result has been securely saved to Supabase.");}
   else {setSaveMessage("Supabase save failed: "+(error?.message||"Unknown error")+". Your result is shown locally.");}
  } else {
   try{const old=JSON.parse(localStorage.getItem("muop-attempts")||"[]");const id=String(Date.now());old.unshift({id,title,score,total:qs.length,date:new Date().toISOString(),answers});localStorage.setItem("muop-attempts",JSON.stringify(old));setAttemptId(id);setSaveMessage("Demo result saved in this browser only.");}catch{setSaveMessage("Could not save local result.");}
  }
  setSubmitted(true);setSaving(false);
 }
 useEffect(()=>{if(!started||submitted)return;const t=setInterval(()=>setSeconds(s=>{if(s<=1){clearInterval(t);void submit();return 0;}return s-1}),1000);return()=>clearInterval(t)},[started,submitted,answers,source]);
 if(source==="loading")return <section className="panel"><h1>Loading questions…</h1><p>Please wait.</p></section>;
 if(!qs.length)return <section className="panel"><h1>No questions available</h1><p>Ask an administrator to publish questions in the Question Bank.</p><Link href="/dashboard">Back to dashboard</Link></section>;
 if(!started)return <section className="panel test-intro"><span className="eyebrow">MISSION UNIFORM OP • PRACTICE</span><h1>{title}</h1><p>{source==="live"?"Live Supabase Question Bank":"Demo practice questions"} • {qs.length} questions • {minutes} minutes</p><ul><li>Choose one option for each question.</li><li>Use Mark for Review to revisit a question.</li><li>Live attempts are graded by Supabase when published questions are available.</li></ul><button className="btn primary" onClick={()=>setStarted(true)}>Start Test</button></section>;
 if(submitted)return <section className="panel result-panel"><span className="eyebrow">TEST COMPLETED</span><h1>Your Result</h1><div className="score-ring">{source==="live"?(liveScore?.score??"Saved"):score}<small>{source==="live"?(liveScore?"/ "+liveScore.total:""):" / "+qs.length}</small></div><p>{saveMessage}</p>{attemptId&&source==="live"&&<p><b>Score is saved in your account.</b> Refresh Test History to see it.</p>}<div className="result-actions"><button className="btn primary" onClick={()=>{setAnswers({});setIdx(0);setReview([]);setSeconds(minutes*60);setSubmitted(false);setStarted(false);setAttemptId(null);setSaveMessage("");setLiveScore(null);}}>Retake Test</button><Link className="btn secondary" href="/test-history">View Test History</Link></div><h2>Answer Review</h2>{qs.map((x,i)=><article className="review-item" key={x.id}><b>Q{i+1}. {x.q}</b><p>Your answer: {answers[x.id]===undefined?"Not answered":x.opts[answers[x.id]]}</p>{source==="demo"&&<p className={answers[x.id]===x.answer?"correct":"incorrect"}>Correct answer: {x.opts[x.answer]}</p>}<small>{x.explain}</small></article>)}</section>;
 return <section className="test-layout"><div className="test-top"><div><span className="eyebrow">{title} · {source==="live"?"LIVE":"DEMO"}</span><h1>Question {idx+1} of {qs.length}</h1></div><div className="timer">⏱ {fmt(seconds)}</div></div><div className="test-grid"><div className="panel question-panel"><div className="question-meta"><span>{q.subject}</span><span>{answers[q.id]===undefined?"Not answered":"Answered"}</span></div><h2>{q.q}</h2>{q.en&&<p className="muted">{q.en}</p>}<div className="options">{q.opts.map((o,i)=><button key={i} onClick={()=>setAnswers(a=>({...a,[q.id]:i}))} className={"option "+(answers[q.id]===i?"selected":"")}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div><div className="question-actions"><button className="btn secondary" onClick={()=>setReview(r=>r.includes(q.id)?r.filter(x=>x!==q.id):[...r,q.id])}>{review.includes(q.id)?"Remove Review":"Mark for Review"}</button><button className="btn secondary" onClick={()=>setAnswers(a=>{const n={...a};delete n[q.id];return n;})}>Clear</button><button className="btn primary" onClick={()=>setIdx(i=>Math.min(qs.length-1,i+1))}>Save & Next →</button></div></div><aside className="panel palette"><h3>Question Palette</h3><div className="palette-grid">{qs.map((x,i)=><button key={x.id} onClick={()=>setIdx(i)} className={(idx===i?"current ":"")+(answers[x.id]!==undefined?"answered ":"")+(review.includes(x.id)?"marked":"")}>{i+1}</button>)}</div><p className="legend">🟢 Answered　⚪ Not answered　🟡 Review</p><div className="palette-foot"><span>{Object.keys(answers).length}/{qs.length} answered</span><button className="btn danger" disabled={saving} onClick={()=>void submit()}>{saving?"Saving…":"Submit Test"}</button></div></aside></div></section>;
}
