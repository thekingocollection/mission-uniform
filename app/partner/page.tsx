"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partnerSupabaseBrowser } from "@/lib/partner-supabase-browser";

type Payload = { partner: any; summary: any; referrals: any[]; commissions: any[]; payouts: any[] };
const money = (paise: number) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const date = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PartnerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"students" | "commissions" | "payouts">("students");
  const [period, setPeriod] = useState<"all" | "30" | "7">("all");
  const sb = partnerSupabaseBrowser();

  const load = useCallback(async (quiet = false) => {
    try {
      if (!sb) throw new Error("Partner portal is unavailable. Please contact Admin.");
      if (quiet) setRefreshing(true); else setLoading(true);
      let { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) {
        const refreshed = await sb.auth.refreshSession();
        session = refreshed.data.session;
      }
      if (!session?.access_token) throw new Error("Your session has expired. Please login again.");
      const response = await fetch("/api/partner", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load partner details.");
      setData(result); setMessage("");
    } catch (e: any) { setMessage(e.message || "Could not load partner dashboard."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [sb]);

  useEffect(() => { void load(); }, [load]);
  async function logout() { await sb?.auth.signOut(); router.replace("/partner/login"); router.refresh(); }

  const p = data?.partner;
  const s = data?.summary || {};
  const link = p?.referral_code && typeof window !== "undefined" ? window.location.origin + "/signup?ref=" + p.referral_code : "";
  const filtered = useMemo(() => {
    const days = period === "all" ? 0 : Number(period);
    const cutoff = days ? Date.now() - days * 86400000 : 0;
    const keep = (row: any) => !cutoff || new Date(row.created_at).getTime() >= cutoff;
    return { referrals: (data?.referrals || []).filter(keep), commissions: (data?.commissions || []).filter(keep) };
  }, [data, period]);
  const conversion = s.students ? Math.round((Number(s.premiumSales || 0) / Number(s.students)) * 100) : 0;
  const avgCommission = s.premiumSales ? Number(s.earnedPaise || 0) / Number(s.premiumSales) : 0;

  async function copyReferral() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { setMessage("Copy failed. Please select and copy the referral link manually."); }
  }
  async function shareReferral() {
    if (!link) return;
    const text = "Join Mission Uniform OP for Odisha exam preparation. Register here: " + link;
    if (navigator.share) { try { await navigator.share({ title: "Mission Uniform OP", text, url: link }); } catch {} }
    else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }

  if (loading) return <main className="mu-partner-loading"><div className="mu-partner-loader">MU</div><b>Opening your Partner Workspace</b><span>Securely loading your referral and commission data…</span></main>;
  if (!p) return <main className="mu-partner-empty"><section><span className="mu-partner-kicker">MISSION UNIFORM OP · PARTNER NETWORK</span><h1>Partner access</h1><p>{message || "This workspace is available only to partner accounts created by Mission Uniform Admin."}</p><Link href="/partner/login" className="mu-partner-primary">Go to Partner Login →</Link></section></main>;

  return <main className="mu-partner-app">
    <header className="mu-partner-header"><Link href="/partner" className="mu-partner-brand"><span className="mu-partner-logo">MU</span><span><b>MISSION UNIFORM OP</b><small>PARTNER BUSINESS WORKSPACE</small></span></Link><div className="mu-partner-header-right"><span className="mu-partner-welcome">Welcome, {p.display_name}</span><span className={"mu-partner-status " + (p.status === "approved" ? "is-approved" : "is-pending")}>{String(p.status).toUpperCase()}</span><button className="mu-partner-logout" onClick={logout}>↪ Logout</button></div></header>
    <div className="mu-partner-content">
      <section className="mu-partner-hero"><div><span className="mu-partner-kicker">PARTNER OVERVIEW</span><h1>Your growth, at a glance.</h1><p>Manage referrals, follow your performance and track your earnings from one place.</p></div><button className="mu-partner-refresh" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh data"}</button></section>
      {message && <div className="mu-partner-alert" role="status">{message}</div>}
      {p.status !== "approved" ? <section className="mu-partner-pending"><span className="mu-partner-pending-icon">⌛</span><div><h2>Your partner account is under review</h2><p>Admin will review your application and confirm your commission rate. Your referral link and earning dashboard will become available after approval.</p></div></section> : <>
        <section className="mu-partner-stat-grid">
          <article className="mu-partner-stat"><span className="mu-partner-stat-icon">♙</span><small>Referred Students</small><strong>{s.students || 0}</strong><em>Total registrations through your code</em></article>
          <article className="mu-partner-stat"><span className="mu-partner-stat-icon">▣</span><small>Premium Purchases</small><strong>{s.premiumSales || 0}</strong><em>Eligible successful purchases</em></article>
          <article className="mu-partner-stat stat-highlight"><span className="mu-partner-stat-icon">₹</span><small>Total Commission</small><strong>{money(s.earnedPaise)}</strong><em>Commission generated to date</em></article>
          <article className="mu-partner-stat"><span className="mu-partner-stat-icon">◷</span><small>Pending Commission</small><strong>{money(s.pendingPaise)}</strong><em>Awaiting payout processing</em></article>
          <article className="mu-partner-stat"><span className="mu-partner-stat-icon">✓</span><small>Paid Commission</small><strong>{money(s.paidPaise)}</strong><em>Already paid to you</em></article>
        </section>
        <section className="mu-partner-share-panel"><div className="mu-partner-share-top"><div><span className="mu-partner-share-kicker">YOUR PERSONAL REFERRAL LINK</span><h2>Share. Refer. Earn.</h2><p>Invite students to Mission Uniform OP. Eligible Premium purchases through your referral are tracked here.</p></div><div className="mu-partner-rate"><small>YOUR COMMISSION RATE</small><b>{p.commission_rate}%</b></div></div><div className="mu-partner-link-row"><span>{link || "Referral link will appear after Admin assigns your referral code."}</span><button onClick={copyReferral} disabled={!link}>{copied ? "✓ Copied" : "Copy link"}</button></div><div className="mu-partner-share-actions"><button onClick={shareReferral} disabled={!link}>↗ Share referral link</button><span>Referral code: <b>{p.referral_code || "Not assigned"}</b></span></div></section>
        <section className="mu-partner-insights"><div className="mu-partner-section-heading"><div><span className="mu-partner-kicker">PERFORMANCE SNAPSHOT</span><h2>Your partner insights</h2></div><label>Period <select value={period} onChange={e => setPeriod(e.target.value as any)}><option value="all">All time</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select></label></div><div className="mu-partner-insight-grid"><article><small>Referral conversion</small><strong>{conversion}%</strong><span>{s.premiumSales || 0} premium purchases from {s.students || 0} referred students</span><div className="mu-partner-progress"><i style={{ width: Math.min(100, conversion) + "%" }}/></div></article><article><small>Average commission per sale</small><strong>{money(avgCommission)}</strong><span>Average based on recorded commission entries</span></article><article><small>New referrals in selected period</small><strong>{filtered.referrals.length}</strong><span>Students who joined during this period</span></article></div></section>
        <section className="mu-partner-records"><div className="mu-partner-section-heading"><div><span className="mu-partner-kicker">YOUR ACTIVITY</span><h2>Partner records</h2><p>Review referred students, commission transactions and payout history.</p></div><div className="mu-partner-tabs"><button className={tab==="students"?"active":""} onClick={()=>setTab("students")}>Students ({filtered.referrals.length})</button><button className={tab==="commissions"?"active":""} onClick={()=>setTab("commissions")}>Commissions ({filtered.commissions.length})</button><button className={tab==="payouts"?"active":""} onClick={()=>setTab("payouts")}>Payouts ({(data.payouts||[]).length})</button></div></div>
          <div className="mu-partner-table-wrap">
          {tab==="students"&&<table><thead><tr><th>Student name</th><th>Student ID</th><th>Joined on</th></tr></thead><tbody>{filtered.referrals.map((r:any)=><tr key={r.id}><td><b>{r.profiles?.full_name||"Student"}</b></td><td>{r.profiles?.student_code||"—"}</td><td>{date(r.created_at)}</td></tr>)}{!filtered.referrals.length&&<tr><td colSpan={3} className="mu-partner-empty-row">No referred students in this period. Share your link to get started.</td></tr>}</tbody></table>}
          {tab==="commissions"&&<table><thead><tr><th>Date</th><th>Purchase amount</th><th>Rate</th><th>Your commission</th><th>Status</th></tr></thead><tbody>{filtered.commissions.map((c:any)=><tr key={c.id}><td>{date(c.created_at)}</td><td>{money(c.amount_paise)}</td><td>{c.commission_rate}%</td><td><b>{money(c.commission_paise)}</b></td><td><span className={"mu-partner-pill "+(c.status==="paid"?"paid":c.status==="reversed"?"reversed":"pending")}>{String(c.status).toUpperCase()}</span></td></tr>)}{!filtered.commissions.length&&<tr><td colSpan={5} className="mu-partner-empty-row">No commission transactions found for this period.</td></tr>}</tbody></table>}
          {tab==="payouts"&&<table><thead><tr><th>Paid on</th><th>Amount</th><th>Payment reference</th><th>Status</th></tr></thead><tbody>{(data.payouts||[]).map((v:any,i:number)=><tr key={String(v.payment_reference||"payout")+"-"+i}><td>{date(v.paid_at)}</td><td><b>{money(v.amount_paise)}</b></td><td>{v.payment_reference||"—"}</td><td><span className="mu-partner-pill paid">PAID</span></td></tr>)}{!(data.payouts||[]).length&&<tr><td colSpan={4} className="mu-partner-empty-row">No payout has been recorded yet.</td></tr>}</tbody></table>}
          </div>
        </section>
        <section className="mu-partner-help"><div><b>Need help with your partnership?</b><span>For commission or payout questions, contact Mission Uniform Admin.</span></div><Link href="/contact">Contact support →</Link></section>
      </>}
      <footer className="mu-partner-footer">MISSION UNIFORM OP · SECURE PARTNER WORKSPACE</footer>
    </div>
  </main>;
}
