"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase-browser";
type Student={id:string;student_code:string|null;full_name:string|null;email:string;mobile:string;role:string;is_blocked:boolean;created_at:string};
export default function StudentDirectoryPage(){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [rows,setRows]=useState<Student[]>([]);
 const [total,setTotal]=useState(0);
 const [query,setQuery]=useState("");
 const [busy,setBusy]=useState(false);
 const [exporting,setExporting]=useState(false);
 const [message,setMessage]=useState("");
 const load=useCallback(async(q="")=>{
  setBusy(true);setMessage("");
  try{
   if(!sb)throw new Error("Supabase configuration missing.");
   const {data:{session}}=await sb.auth.getSession();
   if(!session)throw new Error("Please sign in again.");
   const response=await fetch("/api/admin/student-management"+(q.trim()?"?q="+encodeURIComponent(q.trim()):""),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not load student records.");
   setRows(data.students||[]);setTotal(Number(data.total||0));
  }catch(error:any){setMessage(error.message||"Could not load students.");}
  finally{setBusy(false);}
 },[sb]);
 useEffect(()=>{void load("");},[load]);
 async function exportExcel(){
  setExporting(true);setMessage("");
  try{
   if(!sb)throw new Error("Supabase configuration missing.");
   const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error("Please sign in again.");
   const response=await fetch("/api/admin/student-management?export=1"+(query.trim()?"&q="+encodeURIComponent(query.trim()):""),{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const data=await response.json();if(!response.ok)throw new Error(data.error||"Export failed.");
   const XLSX=await import("xlsx");
   const sheet=XLSX.utils.json_to_sheet((data.students||[]).map((s:Student,i:number)=>({"S.No.":i+1,"Student ID":s.student_code||"","Full Name":s.full_name||"","Email":s.email||"","Mobile":s.mobile||"","Role":s.role||"student","Account Status":s.is_blocked?"Blocked":"Active","Registered At":s.created_at?new Date(s.created_at).toLocaleString("en-IN"):""})));
   sheet["!cols"]=[{wch:8},{wch:22},{wch:28},{wch:34},{wch:18},{wch:14},{wch:24}];
   const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"Student Directory");
   XLSX.writeFile(book,"MISSION_UNIFORM_Student_Directory_"+new Date().toISOString().slice(0,10)+".xlsx");
   setMessage("Exported "+(data.students||[]).length+" student records.");
  }catch(error:any){setMessage(error.message||"Export failed.");}
  finally{setExporting(false);}
 }
 const active=rows.filter(s=>!s.is_blocked).length;
 return <div className="admin-students-page">
  <div className="admin-page-heading"><div><span className="admin-kicker">STAFF WORKSPACE · STUDENT RECORDS</span><h1>Student Directory</h1><p>Authorized student information, contact details and account status.</p></div><div className="admin-actions"><button className="admin-action" onClick={()=>void load(query)} disabled={busy}>↻ Refresh</button><button className="admin-primary compact" onClick={()=>void exportExcel()} disabled={busy||exporting}>{exporting?"Preparing…":"↓ Download Excel"}</button></div></div>
  {message&&<div className="admin-inline-message" role="status">{message}</div>}
  <div className="admin-student-stats"><div className="admin-student-stat"><span>Total Matching Students</span><b>{total}</b><small>Based on current search</small></div><div className="admin-student-stat"><span>Active Accounts</span><b>{active}</b><small>In the displayed records</small></div><div className="admin-student-stat"><span>Loaded Records</span><b>{rows.length}</b><small>Maximum 500 per view</small></div></div>
  <section className="admin-panel">
   <div className="admin-panel-title"><div><span className="admin-kicker">STUDENT INFORMATION</span><h2>All Student Records</h2><p className="admin-muted">Search by Student ID, name, email or mobile number.</p></div><input className="admin-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load(query)} placeholder="Search students…"/></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student ID</th><th>Full Name</th><th>Email / Gmail</th><th>Mobile</th><th>Role</th><th>Registration Date</th><th>Status</th></tr></thead><tbody>
    {rows.map(s=><tr key={s.id}><td><b>{s.student_code||"—"}</b></td><td>{s.full_name||"Name unavailable"}</td><td>{s.email||"—"}</td><td>{s.mobile||"—"}</td><td>{s.role||"student"}</td><td>{s.created_at?new Date(s.created_at).toLocaleString("en-IN"):"—"}</td><td><span className={"admin-pill "+(s.is_blocked?"blocked":"active")}>{s.is_blocked?"Blocked":"Active"}</span></td></tr>)}
    {!rows.length&&<tr><td colSpan={7}>{busy?"Loading student records…":"No student records found."}</td></tr>}
   </tbody></table></div>
   <p className="admin-muted">Showing {rows.length} of {total} matching records. Use Download Excel to export the full matching student directory.</p>
  </section>
  <section className="admin-panel"><h2>Staff Data Access</h2><p className="admin-muted">With Student records permission, you can view and export student IDs, names, registered email addresses, mobile numbers, account role, registration date and active/blocked status. Student passwords are never displayed; existing passwords are securely hashed by the authentication system.</p></section>
 </div>;
}
