"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-client-session";

type FinanceRow = {
  id: string; type: string; student_id: string; student_name: string; mobile: string; email: string;
  product: string; amount_paise: number; currency: string; status: string; purchase_date: string | null;
  duration_days: number | null; access_start: string | null; access_expiry: string | null;
  razorpay_order_id: string; razorpay_payment_id: string;
};
type ProductRow = { product: string; buyers: number; purchases: number; revenue_paise: number };
const EMPTY_SUMMARY = { total_transactions: 0, paid_purchases: 0, unique_buyers: 0, revenue_paise: 0, pending: 0, failed: 0 };
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((paise || 0) / 100);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const statusLabel = (status: string) => status === "paid" ? "Paid" : status === "created" ? "Pending" : status.charAt(0).toUpperCase() + status.slice(1);

export default function FinanceReportPage() {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const load = useCallback(async (search = q, overrides?: { from?: string; to?: string; status?: string; type?: string }) => {
    const dateFrom = overrides?.from ?? from;
    const dateTo = overrides?.to ?? to;
    const paymentStatus = overrides?.status ?? status;
    const paymentType = overrides?.type ?? type;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("From Date cannot be later than To Date.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (paymentStatus) params.set("status", paymentStatus);
      if (paymentType) params.set("type", paymentType);
      if (search.trim()) params.set("q", search.trim());
      const response = await adminFetch("/api/admin/finance-report?" + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load report.");
      setRows(data.rows || []);
      setProducts(data.products || []);
      setSummary(data.summary || EMPTY_SUMMARY);
      setAppliedQuery(search);
    } catch (e: any) {
      setError(e.message || "Finance report load failed.");
    } finally {
      setLoading(false);
    }
  }, [from, to, status, type, q]);

  useEffect(() => { void load(""); }, []);

  const maxProductRevenue = useMemo(() => Math.max(1, ...products.map(p => p.revenue_paise)), [products]);
  const paidRate = summary.total_transactions ? Math.round((summary.paid_purchases / summary.total_transactions) * 100) : 0;

  async function exportExcel() {
    setExporting(true);
    setError("");
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
      const transactionSheet = XLSX.utils.json_to_sheet(transactions);
      transactionSheet["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 26 }, { wch: 15 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 26 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(book, transactionSheet, "All Transactions");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(productSummary), "Product Summary");
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(overview), "Finance Overview");
      XLSX.writeFile(book, "MISSION_UNIFORM_Finance_Report_" + new Date().toISOString().slice(0, 10) + ".xlsx");
    } catch (e: any) {
      setError(e.message || "Excel export failed.");
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFrom(""); setTo(""); setStatus(""); setType(""); setQ("");
    void load("", { from: "", to: "", status: "", type: "" });
  }

  return (
    <div className="admin-finance-page mu-finance">
      <section className="mu-finance-hero">
        <div className="mu-finance-hero-copy">
          <span className="mu-finance-eyebrow">MISSION UNIFORM OP · ADMIN ANALYTICS</span>
          <h1>Finance <em>Overview</em></h1>
          <p>Track student purchases, payment status and subject-wise revenue from one clean dashboard.</p>
          <div className="mu-finance-hero-meta"><span><i className="mu-finance-live-dot" /> Payment records</span><span>Secure admin report</span><span>INR · India</span></div>
        </div>
        <div className="mu-finance-hero-actions">
          <button className="mu-finance-btn mu-finance-btn-ghost" onClick={() => void load()} disabled={loading}><span className={loading ? "mu-finance-spin" : ""}>↻</span> Refresh</button>
          <button className="mu-finance-btn mu-finance-btn-gold" onClick={() => void exportExcel()} disabled={loading || exporting || rows.length === 0}>↓ {exporting ? "Preparing…" : "Export Excel"}</button>
        </div>
        <div className="mu-finance-hero-watermark">₹</div>
      </section>

      {error && <div className="mu-finance-error" role="alert"><span>!</span><div><b>Something needs attention</b><p>{error}</p></div><button onClick={() => void load()}>Try again</button></div>}

      <div className="mu-finance-section-head"><div><span className="mu-finance-kicker">AT A GLANCE</span><h2>Payment performance</h2><p>Summary updates according to the filters you apply.</p></div><span className="mu-finance-record-chip">{summary.total_transactions.toLocaleString("en-IN")} transactions</span></div>
      <section className="mu-finance-metrics">
        <article className="mu-finance-metric mu-finance-metric-revenue"><div className="mu-finance-metric-top"><span className="mu-finance-metric-icon">₹</span><span className="mu-finance-metric-tag">COLLECTED</span></div><span className="mu-finance-metric-label">Total Revenue</span><strong>{loading ? "—" : money(summary.revenue_paise)}</strong><small>Successful payments only</small></article>
        <article className="mu-finance-metric"><div className="mu-finance-metric-top"><span className="mu-finance-metric-icon">♙</span><span className="mu-finance-metric-tag">STUDENTS</span></div><span className="mu-finance-metric-label">Paying Students</span><strong>{loading ? "—" : summary.unique_buyers.toLocaleString("en-IN")}</strong><small>Unique students who purchased</small></article>
        <article className="mu-finance-metric"><div className="mu-finance-metric-top"><span className="mu-finance-metric-icon">✓</span><span className="mu-finance-metric-tag">SUCCESS</span></div><span className="mu-finance-metric-label">Successful Purchases</span><strong>{loading ? "—" : summary.paid_purchases.toLocaleString("en-IN")}</strong><small>{loading ? " " : paidRate + "% of all transactions"}</small></article>
        <article className="mu-finance-metric"><div className="mu-finance-metric-top"><span className="mu-finance-metric-icon">◷</span><span className="mu-finance-metric-tag">ACTION</span></div><span className="mu-finance-metric-label">Pending Payments</span><strong>{loading ? "—" : summary.pending.toLocaleString("en-IN")}</strong><small>Awaiting payment completion</small></article>
        <article className="mu-finance-metric"><div className="mu-finance-metric-top"><span className="mu-finance-metric-icon">!</span><span className="mu-finance-metric-tag">UNSUCCESSFUL</span></div><span className="mu-finance-metric-label">Failed / Refunded</span><strong>{loading ? "—" : summary.failed.toLocaleString("en-IN")}</strong><small>Excluded from revenue</small></article>
      </section>

      <section className="mu-finance-panel">
        <div className="mu-finance-panel-heading"><div><span className="mu-finance-kicker">FIND A TRANSACTION</span><h2>Filter payment records</h2><p>Narrow the report by date, status, payment type or student details.</p></div><span className="mu-finance-filter-icon">⌕</span></div>
        <div className="mu-finance-filters">
          <label><span>Date from</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label><span>Date to</span><input type="date" value={to} onChange={e => setTo(e.target.value)} min={from || undefined} /></label>
          <label><span>Payment status</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="paid">Paid</option><option value="created">Pending / Created</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label>
          <label><span>Payment type</span><select value={type} onChange={e => setType(e.target.value)}><option value="">All payment types</option><option value="Subject Premium">Subject Premium</option><option value="Extra Device Registration">Extra Device Registration</option></select></label>
          <label className="mu-finance-search"><span>Search student or payment</span><div><span>⌕</span><input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void load(); }} placeholder="Name, student ID, mobile, subject…" /></div></label>
        </div>
        <div className="mu-finance-filter-footer"><span>{appliedQuery ? <>Showing results for <b>“{appliedQuery}”</b></> : "Choose your filters, then apply to update the report."}</span><div><button className="mu-finance-btn mu-finance-btn-light" onClick={clearFilters} disabled={loading}>Clear all</button><button className="mu-finance-btn mu-finance-btn-primary" onClick={() => void load()} disabled={loading}>{loading ? "Applying…" : "Apply filters"} <span>→</span></button></div></div>
      </section>

      <section className="mu-finance-panel">
        <div className="mu-finance-panel-heading"><div><span className="mu-finance-kicker">REVENUE BREAKDOWN</span><h2>Subject-wise performance</h2><p>Compare paid purchases and revenue by product or subject.</p></div><span className="mu-finance-panel-count">{products.length} products</span></div>
        {loading ? <div className="mu-finance-loading">Loading product performance…</div> : products.length ? <div className="mu-finance-products">{products.map((p, i) => <div className="mu-finance-product" key={p.product}><div className="mu-finance-product-rank">{String(i + 1).padStart(2, "0")}</div><div className="mu-finance-product-main"><b>{p.product}</b><span>{p.buyers} buyers · {p.purchases} purchases</span><div className="mu-finance-bar"><i style={{ width: Math.max(2, (p.revenue_paise / maxProductRevenue) * 100) + "%" }} /></div></div><strong>{money(p.revenue_paise)}</strong></div>)}</div> : <div className="mu-finance-empty"><span>▤</span><b>No paid sales yet</b><p>Product performance will appear here after successful payments.</p></div>}
      </section>

      <section className="mu-finance-panel mu-finance-register">
        <div className="mu-finance-panel-heading"><div><span className="mu-finance-kicker">TRANSACTION HISTORY</span><h2>Payment register</h2><p>Review student details, payment status, access duration and payment reference.</p></div><span className="mu-finance-panel-count">{rows.length} records</span></div>
        <div className="mu-finance-table-wrap"><table className="mu-finance-table"><thead><tr><th>Student</th><th>Product</th><th>Amount</th><th>Status</th><th>Purchase date</th><th>Access</th><th>Payment reference</th></tr></thead><tbody>
          {rows.map((r, i) => <tr key={r.type + ":" + r.id}><td><div className="mu-finance-student"><span className="mu-finance-avatar">{(r.student_name || "S").trim().charAt(0).toUpperCase()}</span><div><b>{r.student_name || "Student"}</b><small>{r.student_id || "ID unavailable"}</small><small>{r.mobile || r.email || "Contact unavailable"}</small></div></div></td><td><b>{r.product}</b><small className="mu-finance-cell-sub">{r.type}</small></td><td className="mu-finance-amount">{money(r.amount_paise)}</td><td><span className={"mu-finance-status mu-finance-status-" + (r.status === "paid" ? "paid" : r.status === "created" ? "pending" : "other")}><i />{statusLabel(r.status)}</span></td><td>{dateTime(r.purchase_date)}</td><td><b>{r.duration_days ? r.duration_days + " days" : r.type === "Extra Device Registration" ? "One-time" : "—"}</b><small className="mu-finance-cell-sub">Expires: {dateTime(r.access_expiry)}</small></td><td><span className="mu-finance-payment-id">{r.razorpay_payment_id || r.razorpay_order_id || "—"}</span></td></tr>)}
          {!rows.length && <tr><td colSpan={7}><div className="mu-finance-empty mu-finance-empty-inline"><span>▤</span><b>{loading ? "Loading transactions…" : "No transactions found"}</b><p>{loading ? "Please wait while the report is prepared." : "Try changing the date range or clearing your filters."}</p></div></td></tr>}
        </tbody></table></div>
        <div className="mu-finance-register-foot"><span>Showing <b>{rows.length.toLocaleString("en-IN")}</b> records in this report</span><span>Revenue counts only payments marked as paid.</span></div>
      </section>
      <p className="mu-finance-note">Note: Older subject transactions may not have a saved access-duration snapshot. For those records, the currently configured subject duration is shown as an estimate. New successful purchases save the exact duration and expiry.</p>
    </div>
  );
}
