"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHero } from "@/components/content-page";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Paper = {id:string;title:string;description:string|null;exam_year:number|null;exam_name:string|null;session_label:string|null;source_label:string|null;duration_minutes:number;total_questions:number;marks_per_question:number;negative_marking:number};
type PdfPaper = {id:string;title:string;exam_name:string;exam_year:number;session_label:string|null;description:string|null;source_label:string|null;pdf_url:string;pdf_file_name:string};

export default function Page() {
  const router=useRouter();
  const [checking,setChecking]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [papers,setPapers]=useState<Paper[]>([]);
  const [pdfPapers,setPdfPapers]=useState<PdfPaper[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [year,setYear]=useState("all");
  useEffect(()=>{
    let active=true;
    async function run(){
      const sb=supabaseBrowser();
      if(!sb){router.replace("/login?next=/previous-papers");return;}
      const {data,error}=await sb.auth.getUser();
      if(!active)return;
      if(error||!data.user){router.replace("/login?next=/previous-papers");return;}
      const {data:{session}}=await sb.auth.getSession();
      if(!session){router.replace("/login?next=/previous-papers");return;}
      const accessResponse=await fetch("/api/subject-access",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      const accessBody=await accessResponse.json().catch(()=>({}));
      if(!accessResponse.ok)throw new Error(accessBody.error||"Could not verify Previous Year Questions access.");
      const pyq=(accessBody.subjects||[]).find((s:any)=>s.name_en==="Previous Year Questions");
      if(!pyq){setError("Previous Year Questions subject is not configured yet. Please contact Admin.");setAuthorized(true);setChecking(false);setLoading(false);return;}
      if(!pyq.can_start){router.replace("/subject-mock-test?subject="+encodeURIComponent(pyq.subject_id));return;}
      setAuthorized(true);setChecking(false);
      try{
        const headers: Record<string,string> = {Authorization:"Bearer "+session.access_token};
        const [response,pdfResponse]=await Promise.all([
          fetch("/api/tests?type=full",{headers}),
          fetch("/api/previous-year-papers",{headers})
        ]);
        const [body,pdfBody]=await Promise.all([response.json(),pdfResponse.json()]);
        if(!response.ok)throw new Error(body.error||"Previous year questions load nahi hue.");
        if(!pdfResponse.ok)throw new Error(pdfBody.error||"Previous year PDF papers load nahi hue.");
        if(active){setPapers((body.tests||[]).filter((p:any)=>p.is_previous_year));setPdfPapers(pdfBody.papers||[]);}
      }catch(e:any){if(active)setError(e.message||"Unable to load papers.");}
      finally{if(active)setLoading(false);}
    }
    void run();
    return()=>{active=false;};
  },[router]);
  const years=useMemo(()=>Array.from(new Set([...papers.map(p=>p.exam_year),...pdfPapers.map(p=>p.exam_year)].filter(Boolean))).sort((a,b)=>Number(b)-Number(a)),[papers,pdfPapers]);
  const visible=year==="all"?papers:papers.filter(p=>String(p.exam_year)===year);
  const visiblePdfs=year==="all"?pdfPapers:pdfPapers.filter(p=>String(p.exam_year)===year);
  if(checking||!authorized)return <main className="panel" style={{padding:40,textAlign:"center"}}>Checking student login...</main>;
  return <>
    <PageHero title="Previous Year Questions" desc="Odisha Police ke pichhle saalon ke question papers ko actual exam pattern mein solve kijiye."/>
    <section className="panel mu-previous-intro">
      <span className="eyebrow">EXAM PRACTICE ARCHIVE</span>
      <h2>Previous Year Questions & Mock Tests</h2>
      <p>Year-wise papers yahan milenge. Har paper timed mock test ki tarah attempt hoga; answers aur explanation test submit karne ke baad review kar sakte hain.</p>
      <div className="mu-previous-filter"><label htmlFor="paper-year">Filter by exam year</label><select id="paper-year" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={String(y)}>{y}</option>)}</select></div>
    </section>
    {loading&&<section className="panel">Loading Previous Year Questions…</section>}
    {!loading&&error&&<section className="panel"><h3>Could not load papers</h3><p>{error}</p><button className="btn primary" onClick={()=>window.location.reload()}>Retry</button></section>}
    {!loading&&!error&&visiblePdfs.length>0&&<section className="panel mu-previous-pdf-section"><span className="eyebrow">DOWNLOAD / VIEW ORIGINAL PAPERS</span><h2>Previous Year Question Paper PDFs</h2><div className="mu-test-grid mu-previous-grid">{visiblePdfs.map(p=><article className="mu-test-card" key={p.id}><span className="mu-test-type">ORIGINAL QUESTION PAPER</span><h3>{p.exam_name} · {p.exam_year}</h3><p>{p.title}{p.session_label?" · "+p.session_label:""}</p><p>{p.description||p.source_label||"Original previous year question paper PDF."}</p><a className="mu-btn mu-btn-gold mu-test-start" href={p.pdf_url} target="_blank" rel="noreferrer">View / Download PDF ↗</a></article>)}</div></section>}
    {!loading&&!error&&visible.length===0&&visiblePdfs.length===0&&<section className="panel mu-previous-empty"><h3>No previous-year papers published yet</h3><p>Admin jab PDF paper ya online mock test publish karega, woh yahan automatically show hoga.</p><Link className="btn primary" href="/tests">Explore Mock Tests</Link></section>}
    {!loading&&!error&&visible.length>0&&<section className="mu-previous-pdf-section"><span className="eyebrow">ATTEMPT ONLINE</span><h2>Previous Year Papers as Mock Tests</h2><div className="mu-test-grid mu-previous-grid">{visible.map(p=><article className="mu-test-card" key={p.id}>
      <span className="mu-test-type">PREVIOUS YEAR QUESTIONS</span><h3>{p.exam_name||"Odisha Police"} · {p.exam_year}</h3>
      <p>{p.title}{p.session_label?" · "+p.session_label:""}</p><p>{p.description||"Official previous-year paper converted into timed practice."}</p>
      <div className="mu-test-stats"><span><b>{p.total_questions}</b>Questions</span><span><b>{p.duration_minutes} min</b>Duration</span><span><b>{p.marks_per_question}</b>Marks / Q</span></div>
      <small>Negative marking: {p.negative_marking}</small>{p.source_label&&<small>{p.source_label}</small>}
      <Link className="mu-btn mu-btn-gold mu-test-start" href={"/tests/paper/"+p.id}>Start Paper <b>→</b></Link>
    </article>)}</div></section>}
  </>;
}
