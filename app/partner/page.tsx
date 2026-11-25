"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partnerSupabaseBrowser } from "@/lib/partner-supabase-browser";

type Payload = { partner: any; summary: any; referrals: any[]; commissions: any[]; payouts: any[] };
const money = (paise: number) => "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const card: CSSProperties = { background: "#fff", border: "1px solid #e3eaf2", borderRadius: 18, padding: 20, boxShadow: "0 8px 24px rgba(20,43,69,.045)" };
const th: CSSProperties = { padding: "13px 14px", color: "#65758a", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #e8edf3" };
const td: CSSProperties = { padding: "14px", borderBottom: "1px solid #edf1f5", fontSize: 14, color: "#253b53" };

export default function PartnerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const sb = partnerSupabaseBrowser();

  const load = useCallback(async () => {
    try {
      if (!sb) throw new Error("Partner portal is unavailable. Please contact Admin.");
      let { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) {
        const refreshed = await sb.auth.refreshSession();
        session = refreshed.data.session;
      }
      if (!session?.access_token) throw new Error("Your session has expired. Please login again.");
      const response = await fetch("/api/partner", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load partner details.");
      setData(result);
      setMessage("");
    } catch (e: any) { setMessage(e.message || "Could not load partner dashboard."); }
    finally { setLoading(false); }
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  async function logout() {
    await sb?.auth.signOut();
    router.replace("/partner/login");
    router.refresh();
  }

  async function copyReferral() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setMessage("Copy failed. Please select and copy the referral link manually."); }
  }

  if (loading) return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", background: "#f4f7fb", color: "#173451", fontWeight: 800 }}>Loading your secure Partner Workspace…</main>;
  if (!data?.partner) return <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f7fb" }}><section style={{ ...card, maxWidth: 520, width: "100%", padding: 30 }}><span style={{ color: "#a77b2e", fontWeight: 900, letterSpacing: 2, fontSize: 12 }}>MISSION UNIFORM OP · PARTNER NETWORK</span><h1 style={{ color: "#173451", fontSize: 30, margin: "12px 0" }}>Partner access</h1><p style={{ color: "#65758a", lineHeight: 1.7 }}>{message || "This workspace is available only to partner accounts created by Mission Uniform Admin."}</p><Link href="/partner/login" style={{ display: "inline-flex", marginTop: 10, padding: "12px 18px", borderRadius: 10, background: "#173e68", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Go to Partner Login →</Link></section></main>;

  const p = data.partner, s = data.summary || {};
  const link = p.referral_code ? (typeof window !== "undefined" ? window.location.origin : "") + "/signup?ref=" + p.referral_code : "";

  return <main style={{ minHeight: "100vh", background: "#f4f7fb", color: "#173451", paddingBottom: 40 }}>
    <header style={{ background: "#102b49", color: "#fff", padding: "15px clamp(16px,4vw,48px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", boxShadow: "0 5px 22px rgba(10,30,52,.16)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "linear-gradient(145deg,#f0cf83,#b98732)", color: "#173451", fontWeight: 950 }}>MU</span><span><b style={{ display: "block", letterSpacing: ".08em", fontSize: 13 }}>MISSION UNIFORM</b><small style={{ color: "#c5d3e2" }}>PARTNER WORKSPACE</small></span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><span style={{ color: "#d5e0eb", fontSize: 13 }}>Welcome, {p.display_name}</span><span style={{ padding: "7px 12px", borderRadius: 30, background: p.status === "approved" ? "#d8f5e5" : "#fff0cf", color: p.status === "approved" ? "#17633d" : "#8b5d12", fontWeight: 900, fontSize: 11 }}>{String(p.status).toUpperCase()}</span><button onClick={logout} style={{ border: "1px solid #68809a", background: "rgba(255,255,255,.08)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>↪ Logout</button></div>
    </header>
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 18px" }}>
      <div style={{ marginBottom: 22 }}><span style={{ color: "#a77b2e", fontWeight: 900, letterSpacing: ".13em", fontSize: 11 }}>PARTNER OVERVIEW</span><h1 style={{ margin: "7px 0 5px", fontSize: "clamp(26px,4vw,36px)", letterSpacing: "-.03em" }}>Your Partnership Dashboard</h1><p style={{ margin: 0, color: "#718096" }}>Track referrals, premium conversions and your commission in one place.</p></div>
      {p.status !== "approved" ? <section style={{ ...card, background: "#fff9ec", borderColor: "#f0dfb8" }}><b style={{ fontSize: 18 }}>Your partner account is under review</b><p style={{ color: "#78623d", lineHeight: 1.7, marginBottom: 0 }}>Admin will review your application and confirm your commission rate. Your referral link will become available after approval.</p></section> : <>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 14 }}>
          {[[ "Referred Students", s.students || 0, "People who joined using your code" ],[ "Premium Purchases", s.premiumSales || 0, "Successful premium conversions" ],[ "Total Commission", money(s.earnedPaise), "Commission generated so far" ],[ "Pending Commission", money(s.pendingPaise), "Awaiting payout" ],[ "Paid Commission", money(s.paidPaise), "Already paid to you" ]].map(([label,value,desc],i)=><article key={String(label)} style={{ ...card, borderTop: "3px solid " + (i===2 ? "#c69a4b" : "#dce5ef") }}><small style={{ color: "#718096", fontWeight: 750 }}>{label}</small><div style={{ fontSize: 27, fontWeight: 950, margin: "10px 0 5px", color: "#173451" }}>{value}</div><small style={{ color: "#8a98a9", lineHeight: 1.4 }}>{desc}</small></article>)}
        </section>
        <section style={{ ...card, marginTop: 18, background: "linear-gradient(120deg,#173e68,#102b49)", color: "#fff", border: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><span style={{ color: "#e5c37e", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>YOUR PERSONAL REFERRAL LINK</span><h2 style={{ margin: "7px 0", fontSize: 22 }}>Share. Refer. Earn.</h2></div><span style={{ padding: "8px 12px", borderRadius: 30, background: "rgba(255,255,255,.12)", color: "#f2d99f", fontWeight: 850 }}>Commission: {p.commission_rate}%</span></div>
          <div style={{ marginTop: 12, padding: 13, borderRadius: 10, background: "rgba(0,0,0,.18)", color: "#e8eef5", overflowWrap: "anywhere", fontSize: 14 }}>{link || "Referral link will appear after Admin assigns your referral code."}</div>
          <button disabled={!link} onClick={copyReferral} style={{ marginTop: 13, padding: "11px 17px", border: 0, borderRadius: 10, background: "#e4bd70", color: "#173451", fontWeight: 950, cursor: "pointer", opacity: link ? 1 : .5 }}>{copied ? "✓ Copied!" : "Copy Referral Link"}</button>
          <p style={{ color: "#c6d3e1", fontSize: 12, marginBottom: 0 }}>Commission is credited only for eligible successful Premium purchases tracked through your referral code.</p>
        </section>
        <section style={{ ...card, marginTop: 18 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 20 }}>Referred Students</h2><p style={{ color: "#8190a1", margin: "5px 0 0", fontSize: 13 }}>Students registered through your referral link</p></div><b style={{ color: "#a77b2e" }}>{data.referrals.length} students</b></div><div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}><thead><tr><th style={th}>Student</th><th style={th}>Student Code</th><th style={th}>Joined</th></tr></thead><tbody>{data.referrals.map((r: any) => <tr key={r.id}><td style={td}>{r.profiles?.full_name || "Student"}</td><td style={td}>{r.profiles?.student_code || "—"}</td><td style={td}>{new Date(r.created_at).toLocaleDateString("en-IN")}</td></tr>)}{!data.referrals.length && <tr><td colSpan={3} style={{ ...td, color: "#8190a1" }}>No referred students yet. Share your link to get started.</td></tr>}</tbody></table></div></section>
        <section style={{ ...card, marginTop: 18 }}><h2 style={{ margin: 0, fontSize: 20 }}>Commission History</h2><p style={{ color: "#8190a1", margin: "5px 0 0", fontSize: 13 }}>Premium transactions and commission status</p><div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}><thead><tr><th style={th}>Date</th><th style={th}>Premium Amount</th><th style={th}>Rate</th><th style={th}>Commission</th><th style={th}>Status</th></tr></thead><tbody>{data.commissions.map((c: any) => <tr key={c.id}><td style={td}>{new Date(c.created_at).toLocaleDateString("en-IN")}</td><td style={td}>{money(c.amount_paise)}</td><td style={td}>{c.commission_rate}%</td><td style={{ ...td, fontWeight: 850 }}>{money(c.commission_paise)}</td><td style={td}><span style={{ padding: "5px 9px", borderRadius: 20, background: c.status === "paid" ? "#e4f6eb" : "#fff3d9", color: c.status === "paid" ? "#17633d" : "#8b641b", fontWeight: 850, fontSize: 11 }}>{String(c.status).toUpperCase()}</span></td></tr>)}{!data.commissions.length && <tr><td colSpan={5} style={{ ...td, color: "#8190a1" }}>No Premium commission yet.</td></tr>}</tbody></table></div></section>
      </>}
      {message && <p role="status" style={{ color: "#9a4b16", marginTop: 16 }}>{message}</p>}
      <footer style={{ textAlign: "center", color: "#94a1b0", fontSize: 12, padding: "24px 0 0" }}>MISSION UNIFORM OP · Secure Partner Workspace</footer>
    </div>
  </main>;
}
