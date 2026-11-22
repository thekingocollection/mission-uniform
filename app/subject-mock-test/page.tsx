"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EXAM_SUBJECTS, getExamSubject } from "@/lib/exam-subjects";

declare global {
  interface Window { Razorpay?: new (options: any) => { open: () => void; on: (event: string, callback: (response: any) => void) => void }; }
}

type Subject = {
  id: string; subject_id: string; name_en: string | null; name_hi: string | null;
  verified_questions: number; enabled: boolean; can_start: boolean;
  purchased?: boolean; trial_active?: boolean; free_forever?: boolean;
  price_paise?: number; duration_days?: number | null; expires_at?: string | null;
};

const PRESETS = [10, 20, 30, 50, 100];

export default function SubjectMockTestPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [count, setCount] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [trialActive, setTrialActive] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please login to view Mock Test.");
      const headers = { Authorization: "Bearer " + session.access_token };
      const [accessResponse, practiceResponse] = await Promise.all([
        fetch("/api/subject-access", { headers, cache: "no-store" }),
        fetch("/api/subject-practice", { headers, cache: "no-store" })
      ]);
      const accessData: any = await accessResponse.json().catch(() => ({}));
      const practiceData: any = await practiceResponse.json().catch(() => ({}));
      if (!accessResponse.ok) throw new Error(accessData.error || "Subject access could not be loaded.");
      if (!practiceResponse.ok) throw new Error(practiceData.error || "Mock Test subjects could not be loaded.");
      setTrialExpiresAt(accessData.trial_expires_at || null);
      setTrialActive(Boolean(accessData.trial_active));
      const practiceMap = new Map<string, any>((practiceData.subjects || []).map((p: any) => [String(p.subject_id), p]));
      const merged = (accessData.subjects || []).map((s: any) => {
        const canonical = getExamSubject(s.name_en) || getExamSubject(s.name_hi);
        if (!canonical) return null;
        const practice = practiceMap.get(s.id) || {};
        return { ...s, ...practice, ...s, name_en: canonical.name, id: practice.id || "", subject_id: s.id, verified_questions: practice.verified_questions || 0 };
      }).filter(Boolean) as Subject[];
      const ordered = EXAM_SUBJECTS.map(subject => merged.find(item => item.name_en === subject.name)).filter(Boolean) as Subject[];
      setSubjects(ordered);
      const requested = new URLSearchParams(window.location.search).get("subject");
      const initial = merged.find(s => s.subject_id === requested) || merged.find(s => s.subject_id === selectedId) || merged[0];
      if (initial) { setSelectedId(initial.subject_id); setCount(Math.min(30, Math.max(1, initial.verified_questions))); }
    } catch (e: any) { setError(e.message || "Could not load subjects."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => subjects.find(s => s.subject_id === selectedId), [subjects, selectedId]);
  const maxCount = Math.min(100, selected?.verified_questions || 0);
  const visibleSubjects = subjects.filter(s => `${s.name_en || ""} ${s.name_hi || ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  function chooseSubject(id: string) {
    setSelectedId(id);
    const next = subjects.find(s => s.subject_id === id);
    if (next) setCount(Math.min(30, Math.max(1, next.verified_questions)));
  }

  async function unlockSubject() {
    if (!selected || paying) return;
    setPaying(true); setError("");
    try {
      const sb = supabaseBrowser();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) throw new Error("Please login again.");
      const headers = { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token };
      const response = await fetch("/api/subject-access/order", { method: "POST", headers, body: JSON.stringify({ subject_id: selected.subject_id }), cache: "no-store" });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Could not start payment.");
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Payment gateway could not be loaded. Please try again."));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error("Razorpay is unavailable.");
      const checkout = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, name: "MISSION UNIFORM OP",
        description: order.subject_name + " subject access", order_id: order.order_id,
        handler: async (payment: any) => {
          try {
            const verifyResponse = await fetch("/api/subject-access/verify", {
              method: "POST", headers,
              body: JSON.stringify({ razorpay_order_id: payment.razorpay_order_id, razorpay_payment_id: payment.razorpay_payment_id, razorpay_signature: payment.razorpay_signature }),
              cache: "no-store"
            });
            const verified = await verifyResponse.json();
            if (!verifyResponse.ok || !verified.success) throw new Error(verified.error || "Payment verification failed.");
            await load();
          } catch (e: any) { setError(e.message || "Payment verification failed. If money was deducted, contact support."); }
          finally { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
        theme: { color: "#b58b45" }
      });
      checkout.on("payment.failed", (failure: any) => {
        setError(failure?.error?.description || "Payment failed. Please try again.");
        setPaying(false);
      });
      checkout.open();
    } catch (e: any) {
      setError(e.message || "Unable to unlock subject.");
      setPaying(false);
    }
  }

  function startTest() {
    if (!selected?.id || !selected.can_start || count < 1 || count > maxCount || !Number.isInteger(count)) return;
    setStarting(true);
    window.location.href = "/tests/paper/" + selected.id + "?count=" + count;
  }

  const trialTime = trialExpiresAt ? new Date(trialExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

  return <main className="content-wrap mu-subject-practice mu-subject-fast">
    <header className="mu-fast-heading">
      <div><span>MISSION UNIFORM OP</span><h1>Mock Test</h1></div>
      <label className="mu-fast-search"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject..." aria-label="Search subject" /></label>
    </header>
    <section className="mu-fast-message" role="status">
      {trialActive ? <>Your 24-hour free trial is active. Access ends: <b>{trialTime}</b>.</> : <>Your free trial has ended. Purchased subjects remain unlocked; unlock other subjects to continue.</>}
    </section>
    {error && <div className="mu-fast-message" role="alert">{error}</div>}
    {loading ? <div className="mu-fast-empty">Loading subjects...</div> :
      subjects.length === 0 ? <div className="mu-fast-empty">Exam subjects are not configured yet. Please contact the administrator.</div> :
      <section className="mu-fast-subjects" aria-label="Choose subject">
        {visibleSubjects.map(s => {
          const active = s.subject_id === selectedId;
          const status = !s.enabled ? "Admin Locked" : s.purchased ? "Purchased" : s.free_forever ? "Free" : s.trial_active ? "Free Trial" : "Premium";
          return <button type="button" key={s.subject_id} aria-pressed={active} className={"mu-fast-subject " + (active ? "active" : "")} onClick={() => chooseSubject(s.subject_id)}>
            <b>{s.name_en || s.name_hi || "Subject"}</b><small>· {status}</small>
          </button>;
        })}
      </section>
    }
    {selected && <section className="mu-fast-controls">
      {!selected.enabled ? <p className="mu-fast-locked">This subject is currently locked by Admin.</p>
      : !selected.can_start ? <div className="mu-fast-locked">
          <b>{selected.name_en || selected.name_hi} is Premium</b>
          <p>Price: ₹{((selected.price_paise ?? 2900) / 100).toFixed(2)} · Validity: {selected.duration_days ? selected.duration_days + " days" : "Lifetime"}</p>
          <button className="mu-fast-primary" onClick={unlockSubject} disabled={paying}>{paying ? "Opening secure payment..." : "Pay & Unlock Subject →"}</button>
        </div>
      : maxCount === 0 ? <p className="mu-fast-locked">Questions will be available soon.</p>
      : <>
          <div className="mu-fast-count-title"><b>{selected.name_en || selected.name_hi}</b><span>{selected.purchased ? "Purchased access active" : selected.free_forever ? "Free subject" : "24-hour trial access"}</span></div>
          <div className="mu-fast-counts">
            {PRESETS.filter(n => n <= maxCount).map(n => <button type="button" key={n} className={count === n ? "active" : ""} aria-pressed={count === n} onClick={() => setCount(n)}>{n}</button>)}
            <label><span>Custom</span><input type="number" min={1} max={maxCount} value={count} onChange={e => setCount(Number(e.target.value))} aria-label="Custom question count" /></label>
          </div>
          <button className="mu-fast-primary mu-fast-start" disabled={starting || !Number.isInteger(count) || count < 1 || count > maxCount} onClick={startTest}>{starting ? "Starting..." : "Start Test →"}</button>
        </>}
    </section>}
  </main>;
}
