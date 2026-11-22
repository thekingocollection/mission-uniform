"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { EXAM_SUBJECTS, getExamSubject } from "@/lib/exam-subjects";

type Subject = {
  id: string; subject_id: string; name_en: string | null; name_hi: string | null;
  verified_questions: number; enabled: boolean; can_start: boolean;
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
      const accessRaw = await accessResponse.text();
      const practiceRaw = await practiceResponse.text();
      let accessData: any = {}, practiceData: any = {};
      try { accessData = accessRaw ? JSON.parse(accessRaw) : {}; }
      catch { throw new Error("Subject service returned an invalid response. Please refresh."); }
      try { practiceData = practiceRaw ? JSON.parse(practiceRaw) : {}; }
      catch { throw new Error("Question bank service returned an invalid response. Please refresh."); }
      if (!accessResponse.ok) throw new Error(accessData.error || "Subject access could not be loaded.");
      if (!practiceResponse.ok) throw new Error(practiceData.error || "Mock Test subjects could not be loaded.");
      const practiceMap = new Map<string, any>((practiceData.subjects || []).map((p: any) => [String(p.subject_id), p]));
      const merged = (accessData.subjects || [])
        .map((s: any) => {
          const canonical = getExamSubject(s.name_en) || getExamSubject(s.name_hi);
          if (!canonical) return null;
          const practice = practiceMap.get(s.id) || {};
          return {
            ...s, ...practice,
            name_en: canonical.name,
            id: practice.id || "",
            subject_id: s.id,
            verified_questions: practice.verified_questions || 0
          };
        })
        .filter(Boolean) as Subject[];
      const ordered = EXAM_SUBJECTS
        .map(subject => merged.find(item => item.name_en === subject.name))
        .filter(Boolean) as Subject[];
      setSubjects(ordered);
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

  function chooseSubject(id: string) {
    setSelectedId(id);
    const next = subjects.find(s => s.subject_id === id);
    if (next) setCount(Math.min(30, Math.max(1, next.verified_questions)));
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
      subjects.length === 0 ? <div className="mu-fast-empty">Exam subjects are not configured yet. Please contact the administrator.</div> :
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