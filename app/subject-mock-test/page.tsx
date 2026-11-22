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
      if (!session) throw new Error("Please login to view Mock Test.");
      const headers = { Authorization: "Bearer " + session.access_token };
      const [accessResponse, practiceResponse] = await Promise.all([
        fetch("/api/subject-access", { headers, cache: "no-store" }),
        fetch("/api/subject-practice", { cache: "no-store" })
      ]);
      const accessData = await accessResponse.json();
      const practiceData = await practiceResponse.json();
      if (!accessResponse.ok) throw new Error(accessData.error || "Subject access could not be loaded.");
      if (!practiceResponse.ok) throw new Error(practiceData.error || "Mock Test subjects could not be loaded.");
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

  return <main className="content-wrap mu-subject-practice mu-subject-fast">
    <header className="mu-fast-heading">
      <div><span>MISSION UNIFORM OP</span><h1>Mock Test</h1></div>
      <label className="mu-fast-search"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subject..." aria-label="Search subject" /></label>
    </header>

    {error && <div className="mu-fast-message" role="status">{error}</div>}

    {loading ? <div className="mu-fast-empty">Loading subjects...</div> :
      subjects.length === 0 ? <div className="mu-fast-empty">No subjects available.</div> :
      <>
        <section className="mu-fast-subjects" aria-label="Choose subject">
          {visibleSubjects.map(s => {
            const active = s.subject_id === selectedId;
            return <button type="button" key={s.subject_id} aria-pressed={active}
              className={"mu-fast-subject " + (active ? "active" : "")}
              onClick={() => chooseSubject(s.subject_id)}>
              <b>{s.name_en || s.name_hi || "Subject"}</b>
              <small>{s.verified_questions} questions {s.purchased && s.enabled ? "· Unlocked" : !s.enabled ? "· Locked" : ""}</small>
            </button>;
          })}
        </section>
        {visibleSubjects.length === 0 && <div className="mu-fast-empty">No matching subject.</div>}
      </>
    }

    {selected && <section className="mu-fast-controls">
      {!selected.enabled ? <p className="mu-fast-locked">This subject is currently locked.</p>
      : !selected.purchased ? <div className="mu-fast-unlock">
          <div><b>{selected.name_en || selected.name_hi}</b><small>{durationLabel(selected.duration_days)}</small></div>
          <button className="mu-fast-primary" disabled={busy} onClick={() => void startPayment(selected)}>
            {busy ? "Please wait..." : "Unlock · ₹" + (selected.price_paise / 100).toFixed(0)}
          </button>
        </div>
      : maxCount === 0 ? <p className="mu-fast-locked">Questions will be available soon.</p>
      : <>
          <div className="mu-fast-count-title"><b>{selected.name_en || selected.name_hi}</b><span>{maxCount} questions available</span></div>
          <div className="mu-fast-counts">
            {PRESETS.filter(n => n <= maxCount).map(n => <button type="button" key={n}
              className={count === n ? "active" : ""} aria-pressed={count === n}
              onClick={() => setCount(n)}>{n}</button>)}
            <label><span>Custom</span><input type="number" min={1} max={maxCount} value={count}
              onChange={e => setCount(Number(e.target.value))} aria-label="Custom question count" /></label>
          </div>
          <button className="mu-fast-primary mu-fast-start"
            disabled={starting || !Number.isInteger(count) || count < 1 || count > maxCount}
            onClick={startTest}>{starting ? "Starting..." : "Start Test →"}</button>
        </>}
    </section>}
  </main>;
}