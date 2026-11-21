"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Test = { id:string; title:string; test_type:string; duration_minutes:number; total_questions:number; status:string; question_mode?:string; is_previous_year?:boolean; exam_year?:number|null; exam_name?:string|null };
type Question = { id:string; chapter:string|null; question_hi:string|null; question_or:string|null; question_en:string|null; options:any; correct_option:string; explanation?:string|null };

export default function TestManager() {
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [tests,setTests]=useState<Test[]>([]);
  const [subjects,setSubjects]=useState<any[]>([]);
  const [bankQuestions,setBankQuestions]=useState<Question[]>([]);
  const [mode,setMode]=useState<"manual"|"pool">("manual");
  const [title,setTitle]=useState("");
  const [type,setType]=useState("daily");
  const [isPreviousYear,setIsPreviousYear]=useState(false);
  const [managePreviousOnly,setManagePreviousOnly]=useState(false);
  const [examYear,setExamYear]=useState(new Date().getFullYear()-1);
  const [examName,setExamName]=useState("Odisha Police Constable");
  const [sessionLabel,setSessionLabel]=useState("");
  const [sourceLabel,setSourceLabel]=useState("Previous Year Question Paper");
  const [subject,setSubject]=useState("");
  const [chapter,setChapter]=useState("");
  const [duration,setDuration]=useState(30);
  const [count,setCount]=useState(10);
  const [marks,setMarks]=useState(1);
  const [negative,setNegative]=useState(0);
  const [status,setStatus]=useState("draft");
  const [selected,setSelected]=useState<string[]>([]);
  const [questionRows,setQuestionRows]=useState<any[]>([]);
  const [pools,setPools]=useState<any[]>([]);
  const [poolId,setPoolId]=useState("");
  const [fileName,setFileName]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");

  async function load() {
    if(!sb)return;
    const [t,s,q,p]=await Promise.all([
      sb.from("test_papers").select("id,title,test_type,duration_minutes,total_questions,status,question_mode,is_previous_year,exam_year,exam_name").order("created_at",{ascending:false}),
      sb.from("subjects").select("id,name_en,name_hi").eq("is_active",true),
      sb.from("questions").select("id,chapter,question_hi,question_or,question_en,options,correct_option,explanation").eq("is_active",true).eq("verified",true).limit(1000),
      sb.from("question_pools").select("id,title,total_questions,is_active").eq("is_active",true).order("created_at",{ascending:false})
    ]);
    if(t.error)setMessage(t.error.message); else setTests(t.data||[]);
    setSubjects(s.data||[]);setBankQuestions(q.data||[]);setPools(p.data||[]);
  }
  useEffect(()=>{void load()},[sb]);
  const chapters=[...new Set(bankQuestions.map(q=>q.chapter).filter(Boolean))] as string[];
  const visibleBank=bankQuestions.filter(q=>(!chapter||q.chapter===chapter)&&(!search||String(q.question_hi||q.question_en||q.question_or).toLowerCase().includes(search.toLowerCase())));

  function normalizeSheet(rows:any[]) {
    return rows.map((r,i)=>{
      const x:any={};
      Object.entries(r).forEach(([k,v])=>x[k.trim().toLowerCase().replace(/[\s-]+/g,"_")]=String(v??"").trim());
      const opts=[x.option_a,x.option_b,x.option_c,x.option_d];
      const answer=String(x.correct_option||"").toUpperCase();
      if(!x.question_hi||opts.some(v=>!v)||!["A","B","C","D"].includes(answer)) throw new Error("Row "+(i+2)+": question_hi, option_a-d aur correct_option (A/B/C/D) required.");
      return {question_hi:x.question_hi,question_or:x.question_or||null,question_en:x.question_en||null,options:opts,correct_option:answer,explanation:x.explanation_hi||x.explanation_or||x.explanation_en||null,chapter:x.chapter||null,difficulty:x.difficulty||"medium"};
    });
  }
  async function readManualFile(file:File|null) {
    setFileName(file?.name||"");setQuestionRows([]);
    if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error("File maximum 5 MB.");
      const book=XLSX.read(await file.arrayBuffer(),{type:"array"});
      const raw=XLSX.utils.sheet_to_json<Record<string,any>>(book.Sheets[book.SheetNames[0]],{defval:""});
      if(!raw.length)throw new Error("File mein questions nahi hain.");
      const rows=normalizeSheet(raw);
      if(rows.length>300)throw new Error("Manual paper mein maximum 300 questions allowed.");
      setQuestionRows(rows);setCount(rows.length);setMessage(rows.length+" questions ready.");
    }catch(e:any){setMessage(e.message||"File read nahi hui.");}
  }
  function addBlankQuestion(){setQuestionRows(old=>[...old,{question_hi:"",question_or:"",question_en:"",options:["","","",""],correct_option:"A",explanation:"",chapter:chapter||null,difficulty:"medium"}]);}
  function updateRow(i:number,key:string,value:any){setQuestionRows(old=>old.map((q,j)=>i===j?{...q,[key]:value}:q));}
  function downloadTemplate(){
    const headers=["question_hi","question_or","question_en","option_a","option_b","option_c","option_d","correct_option","explanation_hi","chapter","difficulty"];
    const example=["भारत की राजधानी क्या है?","","What is the capital of India?","नई दिल्ली","मुंबई","कोलकाता","चेन्नई","A","नई दिल्ली भारत की राजधानी है।","भारत का भूगोल","easy"];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,example]),"Questions");
    XLSX.writeFile(wb,"MUOP_Manual_Test_Template.xlsx");
  }
  async function save(){
    if(!sb)return;
    if(!title.trim()){setMessage("Test title likhein.");return;}
    if(mode==="manual"&&!questionRows.length&&!selected.length){setMessage("Manual Test ke liye Excel upload karein ya Question Bank se questions select karein.");return;}
    const manualCount=questionRows.length||selected.length;
    if(mode==="manual"&&count!==manualCount){setMessage("Question count aur selected/uploaded questions match hone chahiye.");return;}
    if(mode==="pool"&&!poolId){setMessage("Question Pool select karein.");return;}
    setBusy(true);setMessage("");
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session)throw new Error("Admin session nahi mila. Dobara login karein.");
      if(mode==="manual"&&questionRows.length){
        const {data:{user}}=await sb.auth.getUser();
        const {data:test,error:testError}=await sb.from("test_papers").insert({
          title:title.trim(),description:isPreviousYear?"Previous year question paper":type+" manual practice",test_type:isPreviousYear?"full":type,subject_id:subject||null,chapter:chapter||null,
          is_previous_year:isPreviousYear,exam_year:isPreviousYear?examYear:null,exam_name:isPreviousYear?examName:null,session_label:isPreviousYear?(sessionLabel||null):null,source_label:isPreviousYear?(sourceLabel||null):null,
          question_mode:"manual",pool_id:null,duration_minutes:duration,total_questions:questionRows.length,
          marks_per_question:marks,negative_marking:negative,status,created_by:user?.id
        }).select("id").single();
        if(testError)throw testError;
        const {data:privatePool,error:poolError}=await sb.from("question_pools").insert({
          title:title.trim()+" · Manual paper",description:"Private fixed question set for "+title.trim(),
          subject_id:subject||null,test_paper_id:test.id,created_by:user?.id
        }).select("id").single();
        if(poolError){await sb.from("test_papers").delete().eq("id",test.id);throw poolError;}
        const questionsToInsert=questionRows.map(q=>({
          pool_id:privatePool.id,question_hi:q.question_hi,question_or:q.question_or||null,question_en:q.question_en||null,
          options:q.options,correct_option:q.correct_option,explanation_hi:q.explanation||null,
          chapter:q.chapter||null,difficulty:q.difficulty||"medium",source_row:null
        }));
        const {error:insertError}=await sb.from("pool_questions").insert(questionsToInsert);
        if(insertError){await sb.from("test_papers").delete().eq("id",test.id);throw insertError;}
        const {error:modeError}=await sb.from("test_papers").update({question_mode:"pool",pool_id:privatePool.id}).eq("id",test.id);
        if(modeError){await sb.from("test_papers").delete().eq("id",test.id);throw modeError;}
      } else {
        const payload:any={title:title.trim(),description:isPreviousYear?"Previous year question paper":type+" practice",test_type:isPreviousYear?"full":type,subject_id:subject||null,chapter:chapter||null,
          is_previous_year:isPreviousYear,exam_year:isPreviousYear?examYear:null,exam_name:isPreviousYear?examName:null,session_label:isPreviousYear?(sessionLabel||null):null,source_label:isPreviousYear?(sourceLabel||null):null,
          question_mode:mode,pool_id:mode==="pool"?poolId:null,duration_minutes:duration,total_questions:mode==="pool"?count:Math.min(count,selected.length),
          marks_per_question:marks,negative_marking:negative,status};
        const response=await fetch("/api/tests",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
          body:JSON.stringify({...payload,question_ids:mode==="manual"?selected.slice(0,count):[]})});
        const data=await response.json();if(!response.ok)throw new Error(data.error||"Test save failed.");
      }
      setMessage("Test paper successfully saved.");
      setTitle("");setQuestionRows([]);setSelected([]);setPoolId("");setFileName("");setIsPreviousYear(false);
      await load();
    }catch(e:any){setMessage(e.message||"Test save nahi hua.");}
    finally{setBusy(false);}
  }
  const visibleTests=tests.filter(t=>managePreviousOnly?!!t.is_previous_year:!t.is_previous_year);
  async function updateStatus(id:string,next:string){
    if(!sb)return;
    const {error}=await sb.from("test_papers").update({status:next}).eq("id",id);
    setMessage(error?.message||"Status updated.");await load();
  }
  if(!sb)return <section className="panel">Supabase configuration missing.</section>;
  return <div className="admin-tests-page">
    <section className="panel">
      <span className="eyebrow">MISSION UNIFORM OP · ADMIN</span><h1>Mock Test Builder</h1>
      <div className="mu-admin-mode-switch"><button type="button" className={!managePreviousOnly?"active":""} onClick={()=>setManagePreviousOnly(false)}>Regular Mock Tests</button><button type="button" className={managePreviousOnly?"active":""} onClick={()=>{setManagePreviousOnly(true);setIsPreviousYear(true);setMode("manual");setType("full");}}>Previous Year Papers</button></div>
      <p>Daily / full mock tests ke saath year-wise Previous Year Question Papers bhi create aur publish karein.</p>
      <label className="mu-prev-toggle"><input type="checkbox" checked={isPreviousYear||managePreviousOnly} disabled={managePreviousOnly} onChange={e=>{setIsPreviousYear(e.target.checked);if(e.target.checked){setType("full");setMode("manual");}}}/> This is a Previous Year Paper</label>
      {isPreviousYear&&<div className="form-grid mu-prev-metadata">
        <label>Exam year<input className="input" type="number" min="2000" max="2100" value={examYear} onChange={e=>setExamYear(+e.target.value)}/></label>
        <label>Exam name<input className="input" value={examName} onChange={e=>setExamName(e.target.value)} placeholder="Odisha Police Constable"/></label>
        <label>Shift / Session<input className="input" value={sessionLabel} onChange={e=>setSessionLabel(e.target.value)} placeholder="Shift 1 / Morning / General"/></label>
        <label>Paper source label<input className="input" value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)} placeholder="Official Previous Year Question Paper"/></label>
      </div>}
      <label>Test title<input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Odisha Police Mock Test 01"/></label>
      <div className="form-grid">
        <label>Test type<select className="input" value={type} onChange={e=>setType(e.target.value)}>{["daily","subject","chapter","full","grand"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Question source<select className="input" value={mode} onChange={e=>{setMode(e.target.value as any);setSelected([]);setQuestionRows([]);}}><option value="manual">Manual upload / selected questions</option><option value="pool">Random Question Pool</option></select></label>
        <label>Subject<select className="input" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name_en||s.name_hi}</option>)}</select></label>
        <label>Chapter<select className="input" value={chapter} onChange={e=>setChapter(e.target.value)}><option value="">All chapters</option>{chapters.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Duration (minutes)<input className="input" type="number" min="1" max="300" value={duration} onChange={e=>setDuration(+e.target.value)}/></label>
        <label>Questions to show<input className="input" type="number" min="1" max="300" value={count} onChange={e=>setCount(+e.target.value)}/></label>
        <label>Marks per question<input className="input" type="number" min="0" step=".25" value={marks} onChange={e=>setMarks(+e.target.value)}/></label>
        <label>Negative marking<input className="input" type="number" min="0" step=".25" value={negative} onChange={e=>setNegative(+e.target.value)}/></label>
        <label>Initial status<select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
      </div>
      {mode==="pool"?<>
        <h3>Choose Question Pool</h3>
        <select className="input" value={poolId} onChange={e=>setPoolId(e.target.value)}><option value="">Select pool</option>{pools.map(p=><option key={p.id} value={p.id}>{p.title} · {p.total_questions} questions</option>)}</select>
        <p className="muted">Har student ko pehle unseen questions milenge. Pool cycle complete hone par naya shuffle hoga.</p>
      </>:<>
        <div className="mu-admin-upload-actions"><button type="button" className="btn secondary" onClick={downloadTemplate}>Download Excel Template</button>
          <label className="btn secondary">Upload Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>void readManualFile(e.target.files?.[0]||null)}/></label>
          <button type="button" className="btn secondary" onClick={addBlankQuestion}>+ Add question</button>
        </div>
        {fileName&&<p className="muted">File: {fileName}</p>}
        {questionRows.length>0&&<><h3>Uploaded Questions ({questionRows.length})</h3><div className="mu-manual-preview">{questionRows.map((q,i)=><article key={i}><b>Q{i+1}</b><p>{q.question_hi||"Question text"}</p><small>Correct option: {q.correct_option}</small></article>)}</div></>}
        {questionRows.length===0&&<><h3>Or select from Question Bank ({selected.length} selected)</h3><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search verified questions"/>
          <div className="question-select-list">{visibleBank.slice(0,150).map((q,i)=><label className="question-select-row" key={q.id}><input type="checkbox" checked={selected.includes(q.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,q.id]:old.filter(x=>x!==q.id))}/><span><b>{q.question_hi||q.question_en||q.question_or||("Question "+(i+1))}</b><small>{q.chapter||"General"}</small></span></label>)}</div>
        </>}
      </>}
      <button className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?"Saving...":"Save Test Paper"}</button>
      {message&&<p className="bulk-message" role="status">{message}</p>}
    </section>
    <section className="panel"><h2>{managePreviousOnly?"Previous Year Papers":"Existing Regular Test Papers"}</h2>{visibleTests.length===0?<p>No papers yet.</p>:visibleTests.map(t=><article className="review-item" key={t.id}>
      <b>{t.is_previous_year?"Previous Year · "+(t.exam_name||"Exam")+" · "+(t.exam_year||"Year"):t.title}</b><p>{t.title} · {t.test_type} · {t.question_mode||"legacy"} · {t.duration_minutes} min · {t.total_questions} questions · {t.status}</p>
      <div className="result-actions">{t.status!=="published"&&<button className="btn primary" onClick={()=>void updateStatus(t.id,"published")}>Publish</button>}
      {t.status!=="archived"&&<button className="btn secondary" onClick={()=>void updateStatus(t.id,"archived")}>Archive</button>}
      {t.status==="archived"&&<button className="btn secondary" onClick={()=>void updateStatus(t.id,"draft")}>Restore draft</button>}</div>
    </article>)}</section>
  </div>;
}
