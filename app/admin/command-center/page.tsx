"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-client-session";

type Student = { id:string; student_code:string|null; full_name:string|null; email:string; mobile:string; role:string; is_blocked:boolean; created_at:string };
type Partner = { id:string; user_id:string; display_name:string; referral_code:string|null; status:string; commission_rate:number; referral_count:number; premium_count:number; commission_paise:number; created_at:string; profiles?:{full_name?:string|null;student_code?:string|null}|null };
type Tab = "all" | "students" | "partners";

export default function AdminCommandCenter() {
  const [students,setStudents] = useState<Student[]>([]);
  const [partners,setPartners] = useState<Partner[]>([]);
  const [studentTotal,setStudentTotal] = useState(0);
  const [tab,setTab] = useState<Tab>("all");
  const [query,setQuery] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [updatedAt,setUpdatedAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [studentRes,partnerRes] = await Promise.all([
        adminFetch("/api/admin/student-management"),
        adminFetch("/api/admin/partners")
      ]);
      const [studentData,partnerData] = await Promise.all([studentRes.json(),partnerRes.json()]);
      if (!studentRes.ok) throw new Error(studentData.error || "Student records load nahi hue.");
      if (!partnerRes.ok) throw new Error(partnerData.error || "Partner records load nahi hue. Super Admin login required.");
      setStudents(studentData.students || []);
      setStudentTotal(Number(studentData.total || 0));
      setPartners(partnerData.partners || []);
      setUpdatedAt(new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    } catch (e:any) { setError(e.message || "Command Centre load nahi hua."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const activeStudents = students.filter(s=>!s.is_blocked).length;
  const blockedStudents = students.filter(s=>s.is_blocked).length;
  const approvedPartners = partners.filter(p=>p.status==="approved").length;
  const pendingPartners = partners.filter(p=>p.status==="pending").length;
  const commission = partners.reduce((sum,p)=>sum+Number(p.commission_paise||0),0);
  const q = query.trim().toLowerCase();
  const filteredStudents = useMemo(()=>students.filter(s=>!q || [s.student_code,s.full_name,s.email,s.mobile].some(v=>String(v||"").toLowerCase().includes(q))),[students,q]);
  const filteredPartners = useMemo(()=>partners.filter(p=>!q || [p.display_name,p.referral_code,p.status,p.profiles?.full_name,p.profiles?.student_code].some(v=>String(v||"").toLowerCase().includes(q))),[partners,q]);

  return <div className="mu-command">
    <div className="admin-page-heading"><div><span className="admin-kicker">SUPER ADMIN · UNIFIED INTELLIGENCE</span><h1>Smart Command Centre</h1><p>Students aur Partners ka complete operational overview ek hi workspace mein.</p></div><div className="admin-actions"><span className="mu-command-updated">{updatedAt ? "Updated "+updatedAt : "Live data"}</span><button className="admin-primary compact" onClick={()=>void load()} disabled={loading}>{loading?"Loading…":"↻ Refresh Data"}</button></div></div>
    {error && <div className="admin-inline-message" role="alert">{error}</div>}
    <div className="mu-command-stats">
      <article><small>Total Students</small><strong>{loading?"—":studentTotal.toLocaleString("en-IN")}</strong><span>Registered accounts</span></article>
      <article><small>Active Students</small><strong>{loading?"—":activeStudents.toLocaleString("en-IN")}</strong><span>Latest 500 records</span></article>
      <article><small>Blocked Students</small><strong>{loading?"—":blockedStudents.toLocaleString("en-IN")}</strong><span>Latest 500 records</span></article>
      <article><small>Total Partners</small><strong>{loading?"—":partners.length}</strong><span>All partner accounts</span></article>
      <article><small>Approved Partners</small><strong>{loading?"—":approvedPartners}</strong><span>Active referral network</span></article>
      <article><small>Pending Requests</small><strong>{loading?"—":pendingPartners}</strong><span>Awaiting review</span></article>
      <article><small>Partner Commission</small><strong>{loading?"—":"₹"+(commission/100).toLocaleString("en-IN",{maximumFractionDigits:2})}</strong><span>Recorded, non-reversed</span></article>
    </div>

    <section className="admin-panel mu-command-panel">
      <div className="mu-command-toolbar"><div><span className="admin-kicker">CENTRAL RECORD EXPLORER</span><h2>People & Network</h2><p className="admin-muted">Search student ID, name, mobile, email, partner name ya referral code.</p></div><input className="admin-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="⌕  Search all records…" type="search"/></div>
      <div className="mu-command-tabs" role="tablist" aria-label="Record type">
        <button className={tab==="all"?"active":""} onClick={()=>setTab("all")}>All Records</button>
        <button className={tab==="students"?"active":""} onClick={()=>setTab("students")}>Students ({studentTotal})</button>
        <button className={tab==="partners"?"active":""} onClick={()=>setTab("partners")}>Partners ({partners.length})</button>
      </div>

      {(tab==="all"||tab==="students") && <div className="mu-command-section">
        <div className="mu-command-section-head"><div><h3>🎓 Student Intelligence</h3><p>{filteredStudents.length} displayed · {studentTotal} total registered</p></div><Link href="/admin/students">Open Full Student Management →</Link></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Mobile</th><th>Joined</th><th>Status</th></tr></thead><tbody>
          {filteredStudents.slice(0,tab==="all"?8:100).map(s=><tr key={s.id}><td><b>{s.student_code||"—"}</b></td><td>{s.full_name||"Student"}</td><td>{s.email||"—"}</td><td>{s.mobile||"—"}</td><td>{s.created_at?new Date(s.created_at).toLocaleDateString("en-IN"):"—"}</td><td><span className={"admin-pill "+(s.is_blocked?"blocked":"active")}>{s.is_blocked?"Blocked":"Active"}</span></td></tr>)}
          {!filteredStudents.length&&<tr><td colSpan={6}>No matching students.</td></tr>}
        </tbody></table></div>
        {tab==="all"&&filteredStudents.length>8&&<p className="admin-muted">Showing first 8 matches. Select Students tab to explore more.</p>}
        {studentTotal>students.length&&<p className="admin-muted">Directory preview shows latest {students.length} records. Full search and Excel export are available in Student Management.</p>}
      </div>}

      {(tab==="all"||tab==="partners") && <div className="mu-command-section">
        <div className="mu-command-section-head"><div><h3>🤝 Partner Intelligence</h3><p>{filteredPartners.length} partner accounts · referral and commission performance</p></div><Link href="/admin/partners">Open Partnership Management →</Link></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Partner</th><th>Referral Code</th><th>Referrals</th><th>Premium Sales</th><th>Commission</th><th>Status</th></tr></thead><tbody>
          {filteredPartners.slice(0,tab==="all"?8:100).map(p=><tr key={p.id}><td><b>{p.display_name||p.profiles?.full_name||"Partner"}</b><small style={{display:"block"}}>{p.profiles?.student_code||p.user_id}</small></td><td>{p.referral_code||"—"}</td><td>{p.referral_count||0}</td><td>{p.premium_count||0}</td><td>₹{(Number(p.commission_paise||0)/100).toLocaleString("en-IN",{maximumFractionDigits:2})}</td><td><span className={"admin-pill "+(p.status==="approved"?"active":"blocked")}>{p.status}</span></td></tr>)}
          {!filteredPartners.length&&<tr><td colSpan={6}>No matching partners.</td></tr>}
        </tbody></table></div>
        {tab==="all"&&filteredPartners.length>8&&<p className="admin-muted">Showing first 8 matches. Select Partners tab to explore more.</p>}
      </div>}
    </section>

    <div className="mu-command-actions">
      <Link href="/admin/students"><b>🎓 Student Management</b><span>Premium access, private messages, password reset, block status & Excel export</span><i>Open →</i></Link>
      <Link href="/admin/partners"><b>🤝 Partnership Management</b><span>Create partner IDs, approve requests, manage referral codes and commission rates</span><i>Open →</i></Link>
      <Link href="/admin/partner-payouts"><b>₹ Partner Payouts</b><span>Review payout requests and manage manual transfers</span><i>Open →</i></Link>
      <Link href="/admin/live-monitor"><b>◉ Live Command Center</b><span>Monitor live student presence and exam activity</span><i>Open →</i></Link>
    </div>
    <p className="mu-command-note">Privacy & access: this combined workspace is for Super Admin. Student preview is limited to the latest 500 records; use the full Student Management page for complete search and export. Passwords are never displayed.</p>
  </div>;
}
