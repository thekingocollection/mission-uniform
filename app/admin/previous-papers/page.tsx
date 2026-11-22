"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Paper = { id:string; title:string; exam_name:string; exam_year:number; session_label:string|null; pdf_url:string; pdf_file_name:string; status:string; description:string|null };

export default function PreviousPaperManager() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [papers,setPapers] = useState<Paper[]>([]);
  const [title,setTitle] = useState("");
  const [examName,setExamName] = useState("Odisha Police Constable");
  const [year,setYear] = useState(new Date().getFullYear()-1);
  const [session,setSession] = useState("");
  const [description,setDescription] = useState("");
  const [source,setSource] = useState("Official Previous Year Question Paper");
  const [status,setStatus] = useState("draft");
  const [file,setFile] = useState<File|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");

  async function requestHeaders() {
    const {data:{session}} = await sb!.auth.getSession();
    if (!session) throw new Error("Admin login session nahi mila. Dobara login karein.");
    return { Authorization: "Bearer " + session.access_token };
  }
  async function load() {
    if(!sb) return;
    try {
      const headers = await requestHeaders();
      const response = await fetch("/api/previous-year-papers?admin=1",{headers,cache:"no-store"});
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || "Papers load nahi hue.");
      setPapers(body.papers || []);
    } catch(e:any) { setMessage(e.message || "Papers load nahi hue."); }
  }
  useEffect(()=>{void load()},[sb]);

  async function upload(e:React.FormEvent) {
    e.preventDefault();
    if(!sb || !file) { setMessage("PDF file select karein."); return; }
    setBusy(true);setMessage("");
    try {
      const headers = await requestHeaders();
      const form = new FormData();
      form.set("title",title);form.set("exam_name",examName);form.set("exam_year",String(year));
      form.set("session_label",session);form.set("description",description);form.set("source_label",source);
      form.set("status",status);form.set("file",file);
      const response = await fetch("/api/previous-year-papers",{method:"POST",headers,body:form});
      const body = await response.json();
      if(!response.ok) throw new Error(body.error || "Upload failed.");
      setMessage("Previous year PDF successfully uploaded.");
      setTitle("");setSession("");setDescription("");setFile(null);
      const input=document.getElementById("previous-paper-pdf") as HTMLInputElement|null;
      if(input) input.value="";
      await load();
    } catch(e:any) { setMessage(e.message || "Upload failed."); }
    finally { setBusy(false); }
  }
  async function changeStatus(id:string,next:string) {
    try {
      const headers = await requestHeaders();
      const response = await fetch("/api/previous-year-papers",{method:"PATCH",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify({id,status:next})});
      const body=await response.json();if(!response.ok) throw new Error(body.error||"Update failed.");
      setMessage("Paper status updated.");await load();
    } catch(e:any) { setMessage(e.message||"Update failed."); }
  }
  async function remove(id:string) {
    if(!window.confirm("Is previous-year PDF ko permanently delete karna hai?")) return;
    try {
      const headers=await requestHeaders();
      const response=await fetch("/api/previous-year-papers?id="+encodeURIComponent(id),{method:"DELETE",headers});
      const body=await response.json();if(!response.ok) throw new Error(body.error||"Delete failed.");
      setMessage("Paper deleted.");await load();
    } catch(e:any) { setMessage(e.message||"Delete failed."); }
  }

  return <div className="admin-tests-page">
    <section className="panel">
      <span className="eyebrow">MISSION UNIFORM OP · ADMIN LIBRARY</span>
      <h1>Previous Year Paper Library</h1>
      <p>Original question paper PDF upload karke students ko download / view ke liye publish karein. Online mock test banane ke liye Mock Test Builder ka Previous Year Papers mode use karein.</p>
      <form onSubmit={upload} className="mu-prev-admin-form">
        <div className="form-grid">
          <label>Paper title<input className="input" required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Odisha Police Constable Official Paper"/></label>
          <label>Exam name<input className="input" required value={examName} onChange={e=>setExamName(e.target.value)}/></label>
          <label>Exam year<input className="input" type="number" min="2000" max="2100" required value={year} onChange={e=>setYear(+e.target.value)}/></label>
          <label>Shift / Session<input className="input" value={session} onChange={e=>setSession(e.target.value)} placeholder="Shift 1 / Morning"/></label>
          <label>Source label<input className="input" value={source} onChange={e=>setSource(e.target.value)}/></label>
          <label>Publish status<select className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="draft">Save as Draft</option><option value="published">Publish Now</option></select></label>
        </div>
        <label>Description<textarea className="input" rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Paper details / instructions"/></label>
        <label className="mu-prev-file-label">Upload original PDF (maximum 20 MB)<input id="previous-paper-pdf" type="file" accept="application/pdf,.pdf" required onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
        {file&&<p className="muted">Selected: {file.name} · {(file.size/1024/1024).toFixed(2)} MB</p>}
        <button className="btn primary" disabled={busy}>{busy?"Uploading PDF...":"Upload Previous Year Paper"}</button>
      </form>
      {message&&<p className="bulk-message" role="status">{message}</p>}
    </section>
    <section className="panel">
      <h2>Uploaded Papers ({papers.length})</h2>
      {papers.length===0?<p>No PDF papers uploaded yet.</p>:papers.map(p=><article className="review-item" key={p.id}>
        <b>{p.exam_name} · {p.exam_year}</b><p>{p.title}{p.session_label?" · "+p.session_label:""} · {p.pdf_file_name}</p>
        <div className="result-actions">
          <a className="btn secondary" href={p.pdf_url} target="_blank" rel="noreferrer">View PDF ↗</a>
          {p.status!=="published"&&<button className="btn primary" onClick={()=>void changeStatus(p.id,"published")}>Publish</button>}
          {p.status==="published"&&<button className="btn secondary" onClick={()=>void changeStatus(p.id,"draft")}>Unpublish</button>}
          {p.status!=="archived"&&<button className="btn secondary" onClick={()=>void changeStatus(p.id,"archived")}>Archive</button>}
          <button className="btn secondary" onClick={()=>void remove(p.id)}>Delete</button>
        </div>
        <small>Status: {p.status}</small>
      </article>)}
    </section>
  </div>;
}
