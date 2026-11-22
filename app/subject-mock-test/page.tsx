"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

declare global { interface Window { Razorpay?: any } }
type Subject = {
  id: string; subject_id: string; name_en: string | null; name_hi: string | null;
  verified_questions: number; price_paise: number; duration_days: number | null;
  enabled: boolean; purchased: boolean; expires_at: string | null; can_start: boolean;
};

const PRESETS = [10, 20, 30, 50, 100];
function durationLabel(days: number | null) { return days === null ? "Lifetime access" : days === 365 ? "1 year access" : days + " days access"; }

export default function SubjectMockTestPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [count, setCount] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please login to view subject mock tests.");
      const headers = { Authorization: "Bearer " + session.access_token };
      const [accessResponse, practiceResponse] = await Promise.all([
        fetch("/api/subject-access", { headers, cache: "no-store" }),
        fetch("/api/subject-practice", { cache: "no-store" })
      ]);
      const accessData = await accessResponse.json();
      const practiceData = await practiceResponse.json();
      if (!accessResponse.ok) throw new Error(accessData.error || "Subject access could not be loaded.");
      if (!practiceResponse.ok) throw new Error(practiceData.error || "Practice subjects could not be loaded.");
      const practiceMap = new Map<string, any>((practiceData.subjects || []).map((p: any) => [String(p.subject_id), p]));
      const merged = (accessData.subjects || []).map((s: any) => ({
        ...s, ...(practiceMap.get(s.id) || {}),
        id: practiceMap.get(s.id)?.id || "",
        subject_id: s.id,
        verified_questions: practiceMap.get(s.id)?.verified_questions || 0
      })) as Subject[];
      setSubjects(merged);
      const requested = new URLSearchParams(window.location.search).get("subject");
      const initial = merged.find(s => s.subject_id === requested) || merged[0];
      if (initial) { setSelectedId(initial.subject_id); setCount(Math.min(30, Math.max(1, initial.verified_questions))); }
    } catch (e: any) { setError(e.message || "Could not load subjects."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => subjects.find(s => s.subject_id === selectedId), [subjects, selectedId]);
  const maxCount = Math.min(100, selected?.verified_questions || 0);
  const visibleSubjects = subjects.filter(s => `${s.name_en || ""} ${s.name_hi || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const unlockedCount = subjects.filter(s => s.purchased && s.enabled).length;
  const availableCount = subjects.filter(s => s.enabled && s.verified_questions > 0).length;

  function chooseSubject(id: string) {
    setSelectedId(id);
    const next = subjects.find(s => s.subject_id === id);
    if (next) setCount(Math.min(30, Math.max(1, next.verified_questions)));
  }

  async function startPayment(subject: Subject) {
    if (busy || !subject.enabled) return;
    setBusy(true); setError("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please login again.");
      const response = await fetch("/api/subject-access/order", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ subject_id: subject.subject_id })
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Payment order could not be created.");
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(); script.onerror = () => reject(new Error("Payment window could not load."));
          document.body.appendChild(script);
        });
      }
      const checkout = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency,
        name: "MISSION UNIFORM OP", description: order.subject_name + " Subject Access",
        order_id: order.order_id, theme: { color: "#173b50" },
        prefill: { email: session.user.email || "" },
        handler: async (payment: any) => {
          try {
            const verifyResponse = await fetch("/api/subject-access/verify", {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
              body: JSON.stringify(payment)
            });
            const result = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(result.error || "Payment verification failed.");
            await load();
            setError(result.temporarily_locked ? "Payment successful. Admin has temporarily locked this subject; access will resume when it is unlocked." : "Payment successful! Subject access is now active.");
          } catch (e: any) { setError(e.message || "Payment verification failed."); }
          finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      checkout.open();
    } catch (e: any) { setError(e.message || "Payment could not start."); setBusy(false); }
  }

  function startTest() {
    if (!selected?.id || !selected.can_start || count < 1 || count > maxCount || !Number.isInteger(count)) return;
    setStarting(true);
    window.location.href = "/tests/paper/" + selected.id + "?count=" + count;
  }

  return <main className="content-wrap mu-subject-practice">
    <section className="mu-subject-hero">
      <div className="mu-subject-hero-copy">
        <span className="mu-subject-kicker"><i/> MISSION UNIFORM OP · TRAINING COMMAND</span>
        <h1>Subject Wise <em>Mock Test</em></h1>
        <p>Apna subject chuniye, focused practice kijiye aur har attempt ke baad apni performance improve kijiye. Verified questions se fresh practice set milega.</p>
        <div className="mu-subject-hero-tags"><span>✦ VERIFIED QUESTIONS</span><span>✓ YOUR OWN PRACTICE PACE</span><span>◷ PROGRESS THROUGH PRACTICE</span></div>
      </div>
      <div className="mu-subject-hero-mark" aria-hidden="true"><div className="mu-subject-orbit orbit-a"/><div className="mu-subject-orbit orbit-b"/><div className="mu-subject-crest"><span>MU</span><b>✦</b><small>TRAINING</small></div></div>
      <div className="mu-subject-hero-foot"><span>INDIVIDUAL SUBJECT TRAINING</span><span>DISCIPLINE · PRACTICE · SUCCESS</span></div>
    </section>

    {error && <section className="panel" role="status"><p>{error}</p></section>}
    <section className="mu-subject-section">
      <div className="mu-subject-section-head"><div><span className="mu-subject-step">01 / YOUR STUDY PLAN</span><h2>Choose a Subject to Focus On</h2><p>Ek time par ek subject par focus karein. Neeche available verified practice modules dekhein.</p></div><span className="mu-subject-section-icon">▦</span></div>
      {!loading && subjects.length > 0 && <div className="mu-subject-overview"><div><b>{subjects.length}</b><span>Subjects listed</span></div><div><b>{availableCount}</b><span>Ready to practise</span></div><div><b>{unlockedCount}</b><span>Your unlocked subjects</span></div></div>}
      {!loading && subjects.length > 0 && <label className="mu-subject-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject name…" aria-label="Search subjects"/><small>{visibleSubjects.length} results</small></label>}
      {loading ? <div className="mu-subject-state">Subjects load ho rahe hain…</div> :
      subjects.length === 0 ? <div className="mu-subject-state">Abhi subjects available nahi hain.</div> :
      <div className="mu-subject-grid">{visibleSubjects.map((s, i) => {
        const active = s.subject_id === selectedId;
        const icons = ["◈","▤","✥","⌘","◎","◇","✦","▧"];
        return <button type="button" key={s.subject_id} aria-pressed={active} className={"mu-subject-card " + (active ? "is-selected" : "")} onClick={() => chooseSubject(s.subject_id)}>
          <span className="mu-subject-card-top"><i>{icons[i % icons.length]}</i><small>MODULE {String(i + 1).padStart(2,"0")}</small></span>
          <b>{s.name_en || s.name_hi || "Subject"}</b>
          {s.name_hi && s.name_en && <span className="mu-subject-local-name">{s.name_hi}</span>}
          <span className="mu-subject-card-bottom">{!s.enabled ? <><strong>ADMIN LOCKED</strong><i>🔒</i></> : s.purchased ? <><strong>UNLOCKED</strong><i>✓</i></> : <><strong>₹{(s.price_paise / 100).toFixed(0)} · UNLOCK</strong><i>↗</i></>}</span>
        </button>;
      })}</div>}
      {!loading && subjects.length > 0 && visibleSubjects.length === 0 && <div className="mu-subject-state">No subject matches your search. Try another name.</div>}
    </section>

    {selected && <section className="mu-subject-config">
      <div className="mu-subject-config-head"><div><span className="mu-subject-step">02 / SUBJECT ACCESS</span><h2>{selected.name_en || selected.name_hi}</h2><p>{selected.enabled ? durationLabel(selected.duration_days) : "Temporarily unavailable by Admin."}</p></div>
        <div className="mu-subject-selected-pill"><span>SUBJECT PRICE</span><b>₹{(selected.price_paise / 100).toFixed(0)}</b></div>
      </div>
      {!selected.enabled ? <div className="mu-subject-state">This subject is currently locked by Admin. Please check again later.</div>
      : !selected.purchased ? <div className="mu-subject-test-summary"><div className="mu-subject-summary-symbol">₹</div><div className="mu-subject-summary-copy"><small>ONE-TIME SUBJECT PURCHASE</small><b>Unlock all available {selected.name_en || selected.name_hi} mock tests</b><span>{durationLabel(selected.duration_days)} · Secure Razorpay payment</span></div><button className="mu-btn mu-btn-gold" disabled={busy} onClick={() => void startPayment(selected)}>{busy ? "PLEASE WAIT…" : "PAY ₹" + (selected.price_paise / 100).toFixed(0) + " & UNLOCK"}</button></div>
      : <>
        <div className="mu-subject-state">✓ Subject unlocked {selected.expires_at ? "until " + new Date(selected.expires_at).toLocaleDateString("en-IN") : "for lifetime"}.</div>
        {maxCount === 0 ? <div className="mu-subject-state">Mock test is being prepared. Please check back after verified questions are added.</div> : <>
          <div className="mu-subject-count-label"><b>Number of Questions</b><span>Choose a test size</span></div>
          <div className="mu-subject-count-options">{PRESETS.map(n => <button type="button" key={n} disabled={n > maxCount} aria-pressed={count === n} className={count === n ? "active" : ""} onClick={() => setCount(n)}><b>{n}</b><small>QUESTIONS</small></button>)}
            <label className="mu-subject-custom-count"><span>Custom</span><input type="number" min={1} max={maxCount} value={count} onChange={e => setCount(Number(e.target.value))} aria-label="Custom question count"/></label>
          </div>
          <div className="mu-subject-test-summary"><div className="mu-subject-summary-symbol">✦</div><div className="mu-subject-summary-copy"><small>YOUR TEST IS READY</small><b>{selected.name_en || selected.name_hi} Practice</b><span>{count} questions · Random order · Fresh set on every attempt</span></div><div className="mu-subject-summary-count"><b>{count}</b><small>QUESTIONS</small></div></div>
          <button className="mu-subject-start" disabled={starting || !Number.isInteger(count) || count < 1 || count > maxCount} onClick={startTest}><span>{starting ? "PREPARING YOUR TEST…" : "START SUBJECT MOCK TEST"}</span><b>{starting ? "…" : "→"}</b></button>
          <p className="mu-subject-note">Tip: Start with 10–20 questions if you are learning a chapter. Review mistakes, then try a larger set.</p>
        </>}
      </>}
    </section>}
  </main>;
}
