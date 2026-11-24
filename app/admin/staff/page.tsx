"use client";
import {useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase-browser";

type Staff={id:string;email:string|null;full_name:string|null;role:string;permissions:Record<string,boolean>};
const opts=[["manage_students","Student records"],["manage_subjects","Subjects & Chapters"],["manage_questions","Question Bank"],["manage_tests","Mock Tests & Previous Papers"],["manage_jobs","Job Alerts"],["manage_notifications","Notifications"],["manage_feedback","Reviews & Surveys"],["manage_settings","Website Settings"]] as const;

export default function StaffManagement(){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [rows,setRows]=useState<Staff[]>([]);
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [permissions,setPermissions]=useState<Record<string,boolean>>({manage_questions:true});
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function load(){
  if(!sb)return;
  setBusy(true);
  const {data,error}=await sb.from("profiles").select("id,email,full_name,role,permissions").eq("role","staff_admin").order("created_at",{ascending:false});
  if(error)setMessage(error.message);else setRows((data||[]) as Staff[]);
  setBusy(false);
 }
 useEffect(()=>{void load()},[]);
 function toggle(k:string){setPermissions(v=>({...v,[k]:!v[k]}));}
 async function createStaff(e:React.FormEvent){
  e.preventDefault();
  if(!sb)return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await sb.auth.getSession();
   if(!session)throw new Error("Please sign in again as Super Admin.");
   const response=await fetch("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({full_name:name.trim(),email:email.trim().toLowerCase(),password,permissions}),cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Staff account could not be created.");
   setMessage("Staff account created successfully. Share the email and temporary password securely with the staff member.");
   setName("");setEmail("");setPassword("");setPermissions({manage_questions:true});
   await load();
  }catch(error:any){setMessage(error.message||"Staff account could not be created.");}
  finally{setBusy(false);}
 }
 async function remove(row:Staff){
  if(!sb||!window.confirm("Remove staff access for "+(row.email||row.full_name||"this account")+"?"))return;
  setBusy(true);setMessage("");
  try{
   const {data:{session}}=await sb.auth.getSession();
   if(!session)throw new Error("Please sign in again.");
   const response=await fetch("/api/admin/staff",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({email:row.email,enabled:false}),cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Could not remove staff access.");
   setMessage("Staff access removed. The account itself remains available as a normal account.");
   await load();
  }catch(error:any){setMessage(error.message||"Could not remove staff access.");}
  finally{setBusy(false);}
 }
 return <div className="mu-staff-page">
  <div className="admin-page-heading"><div><span className="admin-kicker">ACCESS CONTROL</span><h1>Staff Management</h1><p>Create staff login IDs directly from the Super Admin panel and control their module permissions.</p></div></div>
  <section className="admin-panel mu-staff-form">
   <h2>Create Staff Login</h2>
   <p className="admin-muted">Create an account with the staff member’s email and password. The account will be assigned Staff Admin access immediately.</p>
   <form onSubmit={createStaff}>
    <label>Staff Full Name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} placeholder="Enter staff name" autoComplete="name"/></label>
    <label>Gmail / Email Address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="staff@gmail.com" autoComplete="email"/></label>
    <label>Login Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="Minimum 8 characters" autoComplete="new-password"/></label>
    <div className="mu-permission-grid">{opts.map(([key,label])=><label key={key}><input type="checkbox" checked={!!permissions[key]} onChange={()=>toggle(key)}/><span>{label}</span></label>)}</div>
    <button className="admin-primary" disabled={busy||name.trim().length<2||!email||password.length<8||!Object.values(permissions).some(Boolean)}>{busy?"Creating account…":"＋ Create Staff Account"}</button>
   </form>
  </section>
  <section className="admin-panel">
   <div className="admin-panel-title"><div><h2>Authorized Staff</h2><small>{rows.length} staff accounts</small></div><button className="admin-action" onClick={()=>void load()} disabled={busy}>↻ Refresh</button></div>
   {message&&<p className="admin-inline-message" role="status">{message}</p>}
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Permissions</th><th>Action</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.id}><td>{r.full_name||"Staff"}</td><td>{r.email||"—"}</td><td>{opts.filter(([k])=>r.permissions?.[k]).map(([,v])=>v).join(", ")}</td><td><button className="admin-action danger" disabled={busy} onClick={()=>void remove(r)}>Remove Access</button></td></tr>)}
    {!rows.length&&<tr><td colSpan={4}>No staff accounts created yet.</td></tr>}
   </tbody></table></div>
  </section>
 </div>;
}
