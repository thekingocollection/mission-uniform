"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type FinanceRow = {
  id: string; type: string; student_id: string; student_name: string; mobile: string; email: string;
  product: string; amount_paise: number; currency: string; status: string; purchase_date: string | null;
  duration_days: number | null; access_start: string | null; access_expiry: string | null;
  razorpay_order_id: string; razorpay_payment_id: string;
};
type ProductRow = { product: string; buyers: number; purchases: number; revenue_paise: number };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((paise || 0) / 100);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
export default function FinanceReportPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState({ total_transactions: 0, paid_purchases: 0, unique_buyers: 0, revenue_paise: 0, pending: 0, failed: 0 });
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [status, setStatus] = useState(""); const [type, setType] = useState(""); const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!sb) throw new Error("Supabase configuration missing.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please login as Super Admin.");
      const params = new URLSearchParams();
      if (from) params.set("from", from); if (to) params.set("to", to);
      if (status) params.set("status", status); if (type) params.set("type", type); if (q.trim()) params.set("q", q.trim());
      const response = await fetch("/api/admin/finance-report?" + params.toString(), { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load report.");
      setRows(data.rows || []); setProducts(data.products || []); setSummary(data.summary || { total_transactions: 0, paid_purchases: 0, unique_buyers: 0, revenue_paise: 0, pending: 0, failed: 0 });
    } catch (e: any) { setError(e.message || "Finance report load failed."); }
    finally { setLoading(false); }
  }, [sb, from, to, status, type, q]);
  useEffect(() => { void load(); }, [load]);
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const transactions = rows.map((r, i) => ({
        "S.No.": i + 1, "Student ID": r.student_id, "Student Name": r.student_name, "Mobile": r.mobile, "Email": r.email,
        "Product / Subject": r.product, "Payment Type": r.type, "Amount (INR)": r.amount_paise / 100, "Payment Status": r.status,
        "Purchase Date": dateTime(r.purchase_date), "Access Duration (Days)": r.duration_days ?? "One-time",
        "Access Start": dateTime(r.access_start), "Access Expiry": dateTime(r.access_expiry),
        "Razorpay Order ID": r.razorpay_order_id, "Razorpay Payment ID": r.razorpay_payment_id
      }));
      const productSummary = products.map(p => ({ "Product / Subject": p.product, "Unique Buyers": p.buyers, "Purchases": p.purchases, "Revenue (INR)": p.revenue_paise / 100 }));
      const overview = [
        { Metric: "Total Revenue (successful payments)", Value: summary.revenue_paise / 100 },
        { Metric: "Unique Paying Students", Value: summary.unique_buyers },
        { Metric: "Successful Purchases", Value: summary.paid_purchases },
        { Metric: "All Transactions", Value: summary.total_transactions },
        { Metric: "Pending Payments", Value: summary.pending },
        { Metric: "Failed / Refunded", Value: summary.failed }
      ];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(transactions), "All Transactions");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(productSummary), "Product Summary");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(overview), "Finance Overview");
      XLSX.writeFile(book, "MISSION_UNIFORM_Finance_Report_" + new Date().toISOString().slice(0,10) + ".xlsx");
    } catch (e: any) { setError(e.message || "Excel export failed."); }
    finally { setExporting(false); }
  }
  return <div className="admin-finance-page">
    <div className="admin-page-heading"><div><span className="admin-kicker">FINANCE · SALES & PAYMENTS</span><h1>Finance Report</h1><p>All subject purchases and extra-device payments in one place.</p></div><div className="admin-actions"><button className="admin-action" onClick={() => void load()} disabled={loading}>↻ Refresh</button><button className="admin-primary compact" onClick={() => void exportExcel()} disabled={loading || exporting}>↓ {exporting ? "Preparing Excel…" : "Download Excel"}</button></div></div>
    {error && <div className="admin-inline-message" role="alert">{error}</div>}
    <div className="admin-student-stats">
      <div className="admin-student-stat"><span>Total Revenue</span><b>{loading ? "—" : money(summary.revenue_paise)}</b><small>Successful payments only</small></div>
      <div className="admin-student-stat"><span>Students Who Bought</span><b>{loading ? "—" : summary.unique_buyers}</b><small>Unique paying students</small></div>
      <div className="admin-student-stat"><span>Successful Purchases</span><b>{loading ? "—" : summary.paid_purchases}</b><small>Paid transactions</small></div>
      <div className="admin-student-stat"><span>Pending Payments</span><b>{loading ? "—" : summary.pending}</b><small>Awaiting payment completion</small></div>
      <div className="admin-student-stat"><span>Failed / Refunded</span><b>{loading ? "—" : summary.failed}</b><small>Not included in revenue</small></div>
    </div>
    <section className="admin-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">FILTER REPORT</span><h2>Search Payments</h2></div></div>
      <div className="admin-form-grid">
        <label>From Date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label>To Date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <label>Payment Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="paid">Paid</option><option value="created">Pending / Created</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label>
        <label>Payment Type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All products</option><option value="Subject Premium">Subject Premium</option><option value="Extra Device Registration">Extra Device Registration</option></select></label>
        <label>Search Student / Product<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Student ID, name, mobile, subject, payment ID"/></label>
      </div>
      <div className="admin-actions"><button className="admin-primary compact" onClick={()=>void load()} disabled={loading}>Apply Filters</button><button className="admin-action" onClick={()=>{setFrom("");setTo("");setStatus("");setType("");setQ("");}}>Clear Filters</button><span className="admin-muted">{rows.length} transaction records</span></div>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">PRODUCT PERFORMANCE</span><h2>Subject-wise Sales</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product / Subject</th><th>Unique Buyers</th><th>Purchases</th><th>Revenue</th></tr></thead><tbody>{products.map(p=><tr key={p.product}><td><b>{p.product}</b></td><td>{p.buyers}</td><td>{p.purchases}</td><td>{money(p.revenue_paise)}</td></tr>)}{!products.length&&<tr><td colSpan={4}>{loading?"Loading…":"No successful sales in this filter."}</td></tr>}</tbody></table></div>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-title"><div><span className="admin-kicker">PAYMENT REGISTER</span><h2>All Purchases & Payment History</h2><p className="admin-muted">Student ID, product, paid date, access duration and expiry.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Product</th><th>Amount</th><th>Status</th><th>Purchase Date</th><th>Access Duration</th><th>Expiry Date</th><th>Payment ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.type+":"+r.id}><td><b>{r.student_id || "ID unavailable"}</b><small style={{display:"block"}}>{r.student_name}</small><small style={{display:"block"}}>{r.mobile || r.email || "—"}</small></td><td>{r.product}<small style={{display:"block"}}>{r.type}</small></td><td>{money(r.amount_paise)}</td><td><span className={"admin-pill "+(r.status==="paid"?"active":r.status==="created"?"":"blocked")}>{r.status}</span></td><td>{dateTime(r.purchase_date)}</td><td>{r.duration_days ? r.duration_days+" days" : r.type==="Extra Device Registration" ? "One-time" : "—"}</td><td>{dateTime(r.access_expiry)}</td><td><small>{r.razorpay_payment_id || r.razorpay_order_id || "—"}</small></td></tr>)}{!rows.length&&<tr><td colSpan={8}>{loading?"Loading transactions…":"No payment records found."}</td></tr>}</tbody></table></div>
      <p className="admin-muted">Revenue includes only transactions marked paid. Existing older subject transactions may not have a saved duration snapshot; those rows use the currently configured subject duration as an estimate. New successful purchases save the exact duration and expiry.</p>
    </section>
  </div>;
}
