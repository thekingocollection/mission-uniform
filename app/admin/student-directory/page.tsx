"use client";
import {useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase-browser";
type Student={id:string;student_code:string|null;full_name:string|null;email:string};
export default function StudentDirectoryPage(){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [studentId,setStudentId]=useState("");
 const [student,setStudent]=useState<Student|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function findStudent(e:React.FormEvent){
  e.preventDefault();setBusy(true);setStudent(null);setMessage("");
  try{
   if(!sb)throw new Error("Supabase configuration missing.");
   const {data:{session}}=await sb.auth.getSession();
   if(!session)throw new Error("Please sign in again.");
   const response=await fetch("/api/admin/student-management?q="+encodeURIComponent(studentId.trim().toUpperCase()),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not find student.");
   if(!data.students?.length){setMessage("Is Student ID se koi student nahi mila. ID Super Admin se confirm karein.");return;}
   setStudent(data.students[0]);
  }catch(error:any){setMessage(error.message||"Search failed.");}
  finally{setBusy(false);}
 }
 return <div className="admin-students-page">
  <div className="admin-page-heading"><div><span className="admin-kicker">AUTHORIZED STUDENT LOOKUP</span><h1>Student Directory</h1><p>Super Admin se mila hua Student ID enter karke student ka naam aur Gmail dekhein.</p></div></div>
  {message&&<div className="admin-inline-message" role="status">{message}</div>}
  <section className="admin-panel">
   <h2>Find Student by ID</h2>
   <form onSubmit={findStudent} className="admin-form-grid">
    <label>Student ID<input value={studentId} onChange={e=>setStudentId(e.target.value.toUpperCase())} placeholder="MUOP-2026-000001" required/></label>
    <div style={{display:"flex",alignItems:"end"}}><button className="admin-primary" disabled={busy||!studentId.trim()}>{busy?"Searching…":"Find Student"}</button></div>
   </form>
   {student&&<div className="admin-inline-message" style={{marginTop:18}}>
    <b>Student Found</b><div style={{marginTop:8}}>Student ID: {student.student_code||"—"}</div>
    <div>Name: <b>{student.full_name||"Name not available"}</b></div>
    <div>Gmail / Email: <b>{student.email||"Email not available"}</b></div>
   </div>}
   <p className="admin-muted" style={{marginTop:14}}>Privacy: Staff ko sirf exact Student ID se matching student ka naam aur email dikhaya jayega. Complete student list, mobile number, password aur account controls accessible nahi hain.</p>
  </section>
 </div>;
}
