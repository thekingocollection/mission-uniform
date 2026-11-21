"use client";
import {useEffect,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase-browser";
type Subject={id:string;name_en:string|null;name_hi:string|null;name_or:string|null};
type Question={id:string;chapter:string|null;question_hi:string|null;question_or:string|null;question_en:string|null;subject_id:string};
export default function TestManager(){
 const sb=supabaseBrowser(); const [subjects,setSubjects]=useState<Subject[]>([]); const [questions,setQuestions]=useState<Question[]>([]);
 const [tests,setTests]=useState<any[]>([]); const [title,setTitle]=useState(""); const [type,setType]=useState("daily");
 const [subject,setSubject]=useState(""); const [chapter,setChapter]=useState(""); const [minutes,setMinutes]=useState(30);
 const [count,setCount]=useState(10); const [negative,setNegative]=useState(0); const [selected,setSelected]=useState<string[]>([]);
 const [status,setStatus]=useState("draft"); const [message,setMessage]=useState("");
 async function load(){if(!sb)return;const [s,q,t]=await Promise.all([sb.from("subjects").select("id,name_en,name_hi,name_or").eq("is_active",true),sb.from("questions").select("id,chapter,question_hi,question_or,question_en,subject_id").eq("is_active",true).eq("verified",true).limit(1000),sb.from("test_papers").select("*").order("created_at",{ascending:false})]);setSubjects(s.data??[]);setQuestions(q.data??[]);setTests(t.data??[]);}
 useEffect(()=>{void load()},[]);
 const filtered=questions.filter(q=>(!subject||q.subject_id===subject)&&(!chapter||q.chapter===chapter));
 const chapters=[...new Set(questions.filter(q=>!subject||q.subject_id===subject).map(q=>q.chapter).filter(Boolean))] as string[];
 async function save(){if(!sb)return;setMessage("");if(!title.trim()||selected.length===0){setMessage("Title aur kam se kam 1 verified question select karein.");return;}
 const {data:{session}}=await sb.auth.getSession();if(!session){setMessage("Admin session nahi mila. Dobara login karein.");return;}
 const res=await fetch("/api/tests",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({title,title_description:undefined,description:`${type} practice`,test_type:type,subject_id:subject||null,chapter:chapter||null,duration_minutes:minutes,total_questions:Math.min(count,selected.length),marks_per_question:1,negative_marking:negative,status,question_ids:selected.slice(0,count)})});
 const data=await res.json();if(!res.ok){setMessage(data.error||"Save failed");return;}setMessage("Test paper saved successfully.");setTitle("");setSelected([]);await load();}
 async function updateStatus(id:string,next:string){if(!sb)return;const {error}=await sb.from("test_papers").update({status:next}).eq("id",id);setMessage(error?.message||"Status updated.");await load();}
 if(!sb)return <section className="panel">Supabase browser configuration missing.</section>;
 return <div className="admin-tests-page">
 <section className="panel"><h1>Test Paper Builder</h1><p>Create daily, subject, chapter, full mock and grand tests using verified questions from your Question Bank.</p>
 <label>Test title<input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Odisha Police Daily Mock 01"/></label>
 <div className="form-grid"><label>Test type<select className="input" value={type} onChange={e=>setType(e.target.value)}>{["daily","subject","chapter","full","grand"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 <label>Subject<select className="input" value={subject} onChange={e=>{setSubject(e.target.value);setChapter("");setSelected([])}}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name_en||s.name_hi||s.name_or}</option>)}</select></label>
 <label>Chapter<select className="input" value={chapter} onChange={e=>{setChapter(e.target.value);setSelected([])}}><option value="">All chapters</option>{chapters.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Duration (minutes)<input className="input" type="number" min="1" max="300" value={minutes} onChange={e=>setMinutes(+e.target.value)}/></label>
 <label>Question count<input className="input" type="number" min="1" max="300" value={count} onChange={e=>setCount(+e.target.value)}/></label>
 <label>Negative marking<input className="input" type="number" min="0" step=".25" value={negative} onChange={e=>setNegative(+e.target.value)}/></label>
 <label>Initial status<select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label></div>
 <h3>Select verified questions ({selected.length} selected / {filtered.length} available)</h3><div className="question-select-list">{filtered.map((q,i)=><label key={q.id} className="question-select-row"><input type="checkbox" checked={selected.includes(q.id)} onChange={e=>setSelected(a=>e.target.checked?[...a,q.id]:a.filter(x=>x!==q.id))}/><span><b>{i+1}. {q.question_hi||q.question_or||q.question_en||"Question text missing"}</b><small>{q.chapter||"No chapter"} · {q.id.slice(0,8)}</small></span></label>)}</div>
 <button className="btn primary" onClick={()=>void save()}>Save Test Paper</button>{message&&<p role="status">{message}</p>}</section>
 <section className="panel"><h2>Existing Test Papers</h2>{tests.length===0?<p>No test papers yet.</p>:tests.map(t=><article className="review-item" key={t.id}><b>{t.title}</b><p>{t.test_type} · {t.duration_minutes} min · {t.total_questions} questions · {t.status}</p><div className="result-actions">{t.status!=="published"&&<button className="btn primary" onClick={()=>void updateStatus(t.id,"published")}>Publish</button>}{t.status!=="archived"&&<button className="btn secondary" onClick={()=>void updateStatus(t.id,"archived")}>Archive</button>}{t.status==="archived"&&<button className="btn secondary" onClick={()=>void updateStatus(t.id,"draft")}>Restore draft</button>}</div></article>)}</section>
 </div>
}
