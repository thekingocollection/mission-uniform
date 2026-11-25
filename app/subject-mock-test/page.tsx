"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EXAM_SUBJECTS, getExamSubject } from "@/lib/exam-subjects";

type Subject = {
  id: string; subject_id: string; name_en: string | null; name_hi: string | null;
  verified_questions: number; enabled: boolean; can_start: boolean;
  purchased?: boolean; trial_active?: boolean; free_forever?: boolean;
  price_paise?: number; duration_days?: number | null; expires_at?: string | null;
};


export default function SubjectMockTestPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      if (initial) setSelectedId(initial.subject_id);
    } catch (e: any) { setError(e.message || "Could not load subjects."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!trialActive || !trialExpiresAt) return;
    const expiry = new Date(trialExpiresAt).getTime();
    const delay = Math.max(0, expiry - Date.now() + 500);
    const timer = window.setTimeout(() => { void load(); }, Math.min(delay, 2147480000));
    return () => window.clearTimeout(timer);
  }, [trialActive, trialExpiresAt]);

  const selected = useMemo(() => subjects.find(s => s.subject_id === selectedId), [subjects, selectedId]);

  function chooseSubject(id: string) {
    setSelectedId(id);
  }

  async function unlockSubject(subjectToUnlock: Subject | undefined = selected) {
    if (!subjectToUnlock || paying) return;
    setPaying(true); setError("");
    try {
      const sb = supabaseBrowser();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) throw new Error("Please login again.");
      const headers = { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token };
      const response = await fetch("/api/subject-access/order", { method: "POST", headers, body: JSON.stringify({ subject_id: subjectToUnlock.subject_id }), cache: "no-store" });
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
      const RazorpayConstructor = window.Razorpay as unknown as new (options: any) => {
        open: () => void;
        on: (event: string, callback: (response: any) => void) => void;
      };
      const checkout = new RazorpayConstructor({
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
    if (!selected?.can_start) return;
    if (selected.name_en === "Previous Year Questions") { window.location.href = "/previous-papers"; return; }
    if (!selected.id || selected.verified_questions < 1) return;
    setStarting(true);
    const defaultCount = Math.min(30, selected.verified_questions);
    window.location.href = "/tests/paper/" + selected.id + "?count=" + defaultCount;
  }

  return <main className="content-wrap mu-subject-practice mu-subject-fast mu-subject-clean">
    <header className="mu-subject-clean-heading">
      <span className="mu-subject-kicker">MISSION UNIFORM OP</span>
      <h1>Choose Your Subject</h1>
      <p>Select a subject to begin your preparation.</p>
    </header>
    {error && <div className="mu-fast-message" role="alert">{error}</div>}
    {loading ? <div className="mu-fast-empty">Loading subjects...</div> :
      subjects.length === 0 ? <div className="mu-fast-empty">Exam subjects are not configured yet. Please contact the administrator.</div> :
      <section className="mu-subject-clean-grid" aria-label="Exam subjects">
        {subjects.filter(s => s.name_en !== "Previous Year Questions").map((s, index) => {
          const active = s.subject_id === selectedId;
          const status = !s.enabled ? "Unavailable" : s.purchased ? "Unlocked" : s.free_forever ? "Free" : s.trial_active ? "Free access" : "₹29 · Pay to Unlock";
          return <button type="button" key={s.subject_id} aria-pressed={active} className={"mu-subject-clean-card " + (active ? "active" : "")} onClick={() => chooseSubject(s.subject_id)} style={{animationDelay: (index * 45) + "ms"}}>
            <span className="mu-subject-card-mark" aria-hidden="true">{String(index + 1).padStart(2,"0")}</span>
            <span className="mu-subject-card-name">{s.name_en || s.name_hi || "Subject"}</span>
            <span className={"mu-subject-card-status " + (status.includes("₹29") || status === "Unavailable" ? "muted" : "")}>{status}</span>
            <span className="mu-subject-card-arrow" aria-hidden="true">↗</span>
          </button>;
        })}
      </section>
    }
    {(() => {
      const pyq = subjects.find(s => s.name_en === "Previous Year Questions");
      if (!pyq) return null;
      const unlocked = pyq.can_start;
      return <section className="mu-pyq-promo mu-pyq-promo-compact" aria-label="Previous Year Questions premium access">
        <div className="mu-pyq-promo-copy">
          <span className="mu-pyq-promo-kicker">PREMIUM RESOURCE</span>
          <h2>Previous Year Questions</h2>
          <p>Year-wise Odisha Police papers · PDF + Online Mocks</p>
          
        </div>
        <div className="mu-pyq-promo-action">
          <span className="mu-pyq-promo-price">{unlocked ? "UNLOCKED" : "₹29"}</span>
          <small>{unlocked ? "Your access is active" : "One-time subject unlock"}</small>
          {unlocked
            ? <button type="button" className="mu-pyq-promo-button" onClick={() => { window.location.href = "/previous-papers"; }}>View Previous Year Papers →</button>
            : <button type="button" className="mu-pyq-promo-button" onClick={() => void unlockSubject(pyq)} disabled={paying}>{paying ? "Please wait..." : "₹29 Pay to Unlock →"}</button>}
        </div>
      </section>;
    })()}
    {selected && selected.name_en !== "Previous Year Questions" && <section className="mu-subject-clean-action" aria-live="polite">
      {!selected.enabled ? <p className="mu-fast-locked">This subject is currently unavailable.</p>
      : !selected.can_start ? <div className="mu-subject-action-inner">
          <div><b>{selected.name_en || selected.name_hi}</b><span>Pay ₹29 to unlock this subject and start practising.</span></div>
          <button className="mu-fast-primary" onClick={() => void unlockSubject(selected)} disabled={paying}>{paying ? "Please wait..." : "₹29 Pay to Unlock →"}</button>
        </div>
      : selected.verified_questions < 1 ? <p className="mu-fast-locked">Questions will be available soon.</p>
      : <div className="mu-subject-action-inner">
          <div><b>{selected.name_en || selected.name_hi}</b><span>Ready when you are. Your test will include up to 30 questions.</span></div>
          <button className="mu-fast-primary mu-subject-start-button" disabled={starting} onClick={startTest}>{starting ? "Starting..." : "Start Mock Test →"}</button>
        </div>}
    </section>}
  </main>;
}
