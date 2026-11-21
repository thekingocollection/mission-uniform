"use client";

import { useEffect, useMemo, useState } from "react";

type Subject = { id: string; subject_id: string; name_en: string | null; name_hi: string | null };

const modes = [
  { id: "normal", title: "Normal Mock", subtitle: "Mixed questions from the full subject", icon: "🎯" },
  { id: "easy", title: "Easy Mock", subtitle: "Beginner-friendly easy questions", icon: "🌱" },
] as const;

export default function SubjectMockTestPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [mode, setMode] = useState<"normal" | "easy">("normal");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/subject-practice").then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Subjects load nahi hue.");
      if (!active) return;
      const list = data.subjects || [];
      setSubjects(list);
      const requested = new URLSearchParams(window.location.search).get("subject");
      const initial = list.find((s: Subject) => s.subject_id === requested) || list[0];
      if (initial) setSubjectId(initial.subject_id);
      setLoading(false);
    }).catch((e) => {
      if (active) { setError(e.message || "Subjects load nahi hue."); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => subjects.find((s) => s.subject_id === subjectId), [subjects, subjectId]);

  function start() {
    if (!selected || starting) return;
    setStarting(true);
    setError("");
    window.location.href = "/tests/paper/" + selected.id + "?mode=" + mode;
  }

  return (
    <main className="content-wrap subject-practice-page">
      <section className="subject-practice-hero">
        <div className="subject-practice-hero-copy">
          <span className="subject-practice-kicker">MISSION UNIFORM OP · PRACTICE ARENA</span>
          <h1>Train Today.<br /><em>Lead Tomorrow.</em></h1>
          <p>Apna subject chuniye, difficulty select kijiye aur exam-style mock test dijiye. Har attempt mein fresh random questions milenge.</p>
          <div className="practice-trust"><span>✓ Free practice</span><span>✓ Fresh questions</span><span>✓ Instant result</span></div>
        </div>
        <div className="practice-hero-emblem" aria-hidden="true"><span>✦</span><b>OP</b><small>MISSION UNIFORM</small></div>
      </section>

      <section className="practice-builder panel">
        <div className="practice-section-heading">
          <span className="practice-step">01</span>
          <div><span className="eyebrow">FIRST STEP</span><h2>Choose Your Subject</h2><p>Apni preparation ke liye subject select karein.</p></div>
        </div>

        {loading ? <div className="practice-state">Subjects load ho rahe hain…</div> :
          error && !subjects.length ? <div className="practice-error">{error}</div> :
          !subjects.length ? <div className="practice-state">Abhi subjects available nahi hain. Please baad mein try karein.</div> :
          <div className="practice-subject-grid">
            {subjects.map((subject, index) => {
              const active = subject.subject_id === subjectId;
              return (
                <button type="button" key={subject.subject_id} className={"practice-subject-option" + (active ? " active" : "")} onClick={() => setSubjectId(subject.subject_id)}>
                  <span className="practice-subject-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="practice-subject-name">{subject.name_en || subject.name_hi || "Subject"}</span>
                  <span className="practice-subject-check">{active ? "✓" : "＋"}</span>
                </button>
              );
            })}
          </div>
        }

        <div className="practice-step-divider" />
        <div className="practice-section-heading">
          <span className="practice-step">02</span>
          <div><span className="eyebrow">SECOND STEP</span><h2>Select Difficulty</h2><p>Apne confidence ke hisab se mock test choose karein.</p></div>
        </div>

        <div className="practice-mode-grid">
          {modes.map((item) => (
            <button type="button" key={item.id} className={"practice-mode-card " + (mode === item.id ? "selected" : "")} onClick={() => setMode(item.id)}>
              <span className="practice-mode-icon">{item.icon}</span>
              <span className="practice-mode-copy"><b>{item.title}</b><small>{item.subtitle}</small></span>
              <span className="practice-radio">{mode === item.id ? "✓" : ""}</span>
            </button>
          ))}
        </div>

        {error && <div className="practice-error">{error}</div>}
        <div className="practice-launch-row">
          <div><small>YOUR MOCK TEST</small><b>{selected?.name_en || selected?.name_hi || "Select a subject"} · {mode === "easy" ? "Easy" : "Normal"}</b><span>Random questions · Timed practice · Free</span></div>
          <button type="button" className="practice-start-button" disabled={!selected || starting || loading} onClick={start}>{starting ? "Preparing…" : "Start Mock Test"} <span>→</span></button>
        </div>
      </section>
      <p className="practice-footer-note">Stay consistent. Every mock test takes you one step closer to the uniform.</p>
    </main>
  );
}
