"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Question = {
  id: string;
  question_hi: string | null;
  question_or: string | null;
  question_en: string | null;
  options: any;
  chapter: string | null;
};

// Hide imported practice-set source labels from the student-facing question text.
function cleanStudentQuestion(value: string | null | undefined): string {
  return String(value || "")
    .replace(/\s*[([]\s*Practice\s*Set\s*\d+\s*[,;:-]?\s*Question\s*#?\s*\d+\s*[)]]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type ReviewItem = {
  id: string;
  question: string;
  options: string[];
  selected: number | null;
  correct_option: string;
  explanation: string;
  chapter?: string | null;
  difficulty?: string | null;
  status: "correct" | "wrong" | "skipped";
};

export default function TakeTest({ id }: { id: string }) {
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [flypastRun, setFlypastRun] = useState(0);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<"en" | "or">("en");
  const [paletteOpen, setPaletteOpen] = useState(true);

  const submittedRef = useRef(false);
  const submitRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const sb = supabaseBrowser();
        if (!sb) throw new Error("Supabase connection unavailable.");
        const { data: { session } } = await sb.auth.getSession();
        if (!session) throw new Error("Mock test dekhne ke liye login karein.");
        const response = await fetch(`/api/tests/${id}/questions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const raw = await response.text();
        let data: any = {};
        try { data = raw ? JSON.parse(raw) : {}; }
        catch { throw new Error("Server response invalid. Please refresh and retry."); }
        if (!response.ok) throw new Error(data.error || "Test load nahi hua.");

        if (active) {
          const requestedCount = Number(new URLSearchParams(window.location.search).get("count"));
          const customCount = Number.isInteger(requestedCount) && requestedCount > 0 && requestedCount <= 100 ? requestedCount : null;
          const loadedTest = customCount && data.test.question_mode === "subject_random"
            ? { ...data.test, total_questions: customCount, duration_minutes: customCount }
            : data.test;
          setTest(loadedTest);
          const isOdiaGrammar = /odia\s*(grammar|language)|ଓଡ଼ିଆ\s*(ବ୍ୟାକରଣ|ଭାଷା)/i.test(String(data.test.subject_name_en || data.test.subject_name_or || ""));
          setLanguage(isOdiaGrammar ? "or" : "en");
          setQuestions(data.questions ?? []);
          setSeconds(Number(loadedTest.duration_minutes || 30) * 60);
        }
      } catch (e: any) {
        if (active) setError(e.message);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  function getOptions(value: any, selectedLanguage: "en" | "or" = language): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const raw = typeof item === "string" ? item : String(item?.text ?? item?.value ?? "");
        const parts = raw.split(/\s+\/\s+/);
        return parts.length > 1 ? (selectedLanguage === "or" ? parts.slice(1).join(" / ") : parts[0]) : raw;
      });
    }

    if (value && typeof value === "object") {
      return ["A", "B", "C", "D"].map((key) =>
        String(value[key] ?? "")
      );
    }

    return [];
  }

  async function submit() {
    if (submittedRef.current || saving) return;

    submittedRef.current = true;
    setSaving(true);
    setError("");

    try {
      const sb = supabaseBrowser();

      if (!sb) throw new Error("Supabase connection unavailable.");

      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!session) {
        submittedRef.current = false;
        throw new Error("Result save karne ke liye login karein.");
      }

      if (!attemptId) throw new Error("Test attempt missing. Please restart the test.");
      const response = await fetch(`/api/tests/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ answers, attempt_id: attemptId, language }),
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("Server response invalid. Please try again."); }

      if (!response.ok) {
        submittedRef.current = false;
        throw new Error(data.error || "Submit failed.");
      }

      setResult(data);
    } catch (e: any) {
      submittedRef.current = false;
      setError(e.message || "Result save nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  async function beginTest() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase connection unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Mock test start karne ke liye login karein.");
      const requestedCount = Number(new URLSearchParams(window.location.search).get("count"));
      const customCount = Number.isInteger(requestedCount) && requestedCount > 0 && requestedCount <= 100 ? requestedCount : null;
      const response = await fetch(`/api/tests/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...(customCount ? { question_count: customCount } : {}), language }),
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("Server response invalid. Please check and retry."); }
      if (!response.ok) throw new Error(data.error || "Test start nahi hua.");
      submittedRef.current = false;
      setAttemptId(data.attempt_id);
      document.documentElement.dataset.muActiveAttempt = data.attempt_id;
      setTest(data.test);
      setQuestions(data.questions || []);
      setSeconds(Number(data.test.duration_minutes || 30) * 60);
      setAnswers({});
      setMarked([]);
      setIndex(0);
      setTimeUp(false);
      setStarted(true);
    } catch (e: any) {
      setError(e.message || "Test start nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  submitRef.current = submit;

  // Allow students to move to the previous question with Backspace or Left Arrow.
  // Prevent Backspace from navigating away from the live exam page.
  useEffect(() => {
    if (!started || result || timeUp) return;
    function handleQuestionBack(event: KeyboardEvent) {
      if (event.key !== "Backspace" && event.key !== "ArrowLeft") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      event.preventDefault();
      setIndex((current) => Math.max(0, current - 1));
    }
    window.addEventListener("keydown", handleQuestionBack);
    return () => window.removeEventListener("keydown", handleQuestionBack);
  }, [started, result, timeUp]);

  useEffect(() => {
    if (!started || result || timeUp) return;

    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimeUp(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [started, result, timeUp]);

  // Trigger a brief tricolour aircraft flypast every 30 seconds during a live test.
  useEffect(() => {
    if (!started || result || timeUp) return;
    const flypastTimer = window.setInterval(() => {
      setFlypastRun((run) => run + 1);
    }, 30000);
    return () => window.clearInterval(flypastTimer);
  }, [started, result, timeUp]);

  useEffect(() => {
    if (timeUp && !result) {
      void submitRef.current();
    }
  }, [timeUp, result]);

  function formatTime(value: number) {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function toggleMark(questionId: string) {
    setMarked((old) =>
      old.includes(questionId)
        ? old.filter((x) => x !== questionId)
        : [...old, questionId]
    );
  }

  if (error && !test) {
    return <section className="panel"><h2>{error}</h2></section>;
  }

  if (!test) {
    return <section className="panel"><h2>Loading Mock Test...</h2></section>;
  }

  if (started && !questions.length) {
    return (
      <section className="panel">
        <h2>No questions available</h2>
        <p>Admin se test questions configure karwayein.</p>
      </section>
    );
  }

  const question = questions[index];
  const options = getOptions(question?.options, language);
  const questionText = cleanStudentQuestion(language === "or" ? (question?.question_or || question?.question_en || question?.question_hi || "") : (question?.question_en || question?.question_or || question?.question_hi || ""));
  const isOdiaGrammar = /odia\s*(grammar|language)|ଓଡ଼ିଆ\s*(ବ୍ୟାକରଣ|ଭାଷା)/i.test(String(test.subject_name_en || test.subject_name_or || ""));
  const answeredCount = Object.keys(answers).length;
  const skippedCount = questions.length - answeredCount;

  if (result) {
    const attempt = result.attempt;
    const review: ReviewItem[] = result.review || [];
    const summary = result.summary || {};
    const filteredReview = reviewFilter === "all" ? review : review.filter((entry) => entry.status === reviewFilter);
    const safeReviewIndex = Math.min(reviewIndex, Math.max(0, filteredReview.length - 1));
    const item = filteredReview[safeReviewIndex];
    const elapsed = Number(summary.elapsed_seconds || 0);
    const elapsedLabel = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    const correctPercent = result.total ? Math.round((Number(attempt.correct_count || 0) / result.total) * 100) : 0;

    return (
      <main className="content-wrap mu-exam-shell">
        <section className="panel result-panel mu-exam-result mu-result-dashboard">
          <span className="eyebrow">MISSION UNIFORM OP · PERFORMANCE REPORT</span>
          <h1>Test Completed!</h1>
          <p className="muted">{result.test?.title || test.title}</p>
          <div className="mu-result-hero">
            <div className="score-ring">
              {attempt.score}
              <small>Score</small>
            </div>
            <div className="mu-result-percent">
              <strong>{result.accuracy}%</strong>
              <span>Accuracy</span>
              <div className="mu-result-progress"><i style={{ width: `${Math.max(0, Math.min(100, Number(result.accuracy || 0)))}%` }} /></div>
              <small>{correctPercent}% questions correct</small>
            </div>
          </div>
          <div className="test-result-grid">
            <div><b>{result.total}</b><span>Total Questions</span></div>
            <div><b>{summary.attempted ?? (Number(attempt.correct_count || 0) + Number(attempt.wrong_count || 0))}</b><span>Attempted</span></div>
            <div><b>{attempt.correct_count}</b><span>Correct</span></div>
            <div><b>{attempt.wrong_count}</b><span>Wrong</span></div>
            <div><b>{attempt.skipped_count}</b><span>Unanswered</span></div>
            <div><b>{elapsedLabel}</b><span>Time Taken</span></div>
            <div><b>{summary.positive_marks ?? "—"}</b><span>Positive Marks</span></div>
            <div><b>{summary.negative_marks ?? "—"}</b><span>Negative Marks</span></div>
          </div>
          <p className="mu-result-note">Your result has been saved to your account. Review each answer below to learn from mistakes.</p>
          <div className="mu-result-links">
            <a className="btn secondary" href="/test-history">View Test History</a>
            <a className="btn primary" href="/tests">Explore More Tests</a>
          </div>
        </section>

        <section className="panel mu-answer-review">
          <div className="mu-review-heading">
            <div><span className="eyebrow">LEARN FROM YOUR ATTEMPT</span><h2>Answer Review</h2></div>
            <span className="muted">{filteredReview.length} question(s)</span>
          </div>
          <div className="mu-review-filters" role="group" aria-label="Filter answer review">
            {(["all", "correct", "wrong", "skipped"] as const).map((filter) => {
              const count = filter === "all" ? review.length : review.filter((entry) => entry.status === filter).length;
              return <button key={filter} type="button" className={reviewFilter === filter ? "active" : ""} onClick={() => { setReviewFilter(filter); setReviewIndex(0); }}>
                {filter === "all" ? "All" : filter === "skipped" ? "Unanswered" : filter[0].toUpperCase() + filter.slice(1)} <b>{count}</b>
              </button>;
            })}
          </div>
          {item ? (
            <>
              <div className="mu-review-question-count">Question {safeReviewIndex + 1} of {filteredReview.length}</div>
              <article className={`review-item mu-review-card status-${item.status}`}>
                <div className="mu-review-tags">
                  <span className={`mu-status-tag ${item.status}`}>{item.status === "skipped" ? "UNANSWERED" : item.status.toUpperCase()}</span>
                  {item.chapter && <span>{item.chapter}</span>}
                  {item.difficulty && <span>{item.difficulty}</span>}
                </div>
                <h3>{cleanStudentQuestion(item.question)}</h3>
                <div className="mu-review-options">
                  {item.options.map((option, i) => {
                    const isCorrect = i === ["A", "B", "C", "D"].indexOf(String(item.correct_option).toUpperCase());
                    const isSelected = item.selected === i;
                    return <div key={i} className={`mu-review-option ${isCorrect ? "is-correct" : ""} ${isSelected && !isCorrect ? "is-wrong" : ""}`}>
                      <b>{String.fromCharCode(65 + i)}</b><span>{option}</span>
                      {isCorrect && <strong>Correct answer</strong>}
                      {isSelected && <em>Your answer</em>}
                    </div>;
                  })}
                </div>
                <div className="mu-review-explanation">
                  <b>Explanation</b>
                  <p>{item.explanation || "Explanation is not available for this question yet."}</p>
                </div>
              </article>
              <div className="question-actions mu-review-navigation">
                <button className="btn secondary" disabled={safeReviewIndex === 0} onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}>Previous</button>
                <button className="btn primary" disabled={safeReviewIndex >= filteredReview.length - 1} onClick={() => setReviewIndex((i) => Math.min(filteredReview.length - 1, i + 1))}>Next</button>
              </div>
            </>
          ) : <p className="muted">No questions in this category.</p>}
        </section>
      </main>
    );
  }

  if (!started) {
    return (
      <section className="panel test-intro mu-exam-intro">
        <span className="eyebrow">MISSION UNIFORM OP · EXAM MODE</span>
        <h1>{test.title}</h1>
        <p>{test.description}</p>

        {!isOdiaGrammar && <div className="mu-language-choice" style={{ margin: "18px 0" }}>
          <h3>Choose Exam Language / ପରୀକ୍ଷା ଭାଷା ବାଛନ୍ତୁ</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className={`btn ${language === "en" ? "primary" : "secondary"}`} onClick={() => setLanguage("en")}>English</button>
            <button type="button" className={`btn ${language === "or" ? "primary" : "secondary"}`} onClick={() => setLanguage("or")}>ଓଡ଼ିଆ</button>
          </div>
        </div>}
        {isOdiaGrammar && <p className="muted">ଏହି ବିଷୟର ପରୀକ୍ଷା କେବଳ ଓଡ଼ିଆ ଭାଷାରେ ହେବ।</p>}

        <div className="test-result-grid">
          <div><b>{test.total_questions || questions.length}</b><span>Questions</span></div>
          <div><b>{test.duration_minutes}</b><span>Minutes</span></div>
          <div><b>{test.marks_per_question}</b><span>Marks</span></div>
          <div><b>{test.negative_marking}</b><span>Negative</span></div>
        </div>

        <div className="mu-exam-instructions">
          <h3>Quick Instructions</h3>
          <ul>
            <li><span>01</span><p><b>Select your answer</b><small>Choose one option for each question.</small></p></li>
            <li><span>02</span><p><b>Review anytime</b><small>Mark a question to return to it later.</small></p></li>
            <li><span>03</span><p><b>Watch the timer</b><small>Your test will submit automatically when time ends.</small></p></li>
            <li><span>04</span><p><b>Final submission</b><small>Answers cannot be changed after submission.</small></p></li>
          </ul>
        </div>

        <button
          className="btn primary"
          disabled={saving}
          onClick={() => {
            submittedRef.current = false;
            void beginTest();
          }}
        >
          {saving ? "Starting..." : "Start Mock Test"}
        </button>
        {error && <p className="bulk-message">{error}</p>}
      </section>
    );
  }

  return (
    <main className="content-wrap mu-exam-shell">
      <section className="test-layout mu-exam-layout">
        <div className="test-top mu-mobile-exam-top">
          <div className="mu-mobile-exam-subject">
            <span className="mu-mobile-subject-icon">▤</span>
            <div>
              <span className="eyebrow">MISSION UNIFORM OP · LIVE EXAM</span>
              <h1>{test.subject_name_en || test.title}</h1>
              <p>{test.title}</p>
            </div>
          </div>
          <span className="mu-mobile-question-count">Q. {index + 1} / {questions.length}</span>
          <div className={`timer mu-exam-timer ${seconds <= 300 ? "is-warning" : ""}`} role="timer" aria-live="off" aria-label={`Time remaining ${formatTime(seconds)}`}>
            <div className="mu-exam-timer-top"><span>◴ <span className="mu-timer-label">TIME LEFT</span></span><b>{formatTime(seconds)}</b></div>
            <div className="mu-exam-time-track"><i style={{ width: `${Math.max(0, Math.min(100, (seconds / (Math.max(1, Number(test.duration_minutes || 30) * 60))) * 100))}%` }} /></div>
          </div>
          <button type="button" className="btn danger mu-mobile-submit" disabled={saving} onClick={() => {
            const ok = window.confirm(`Submit test now? Answered: ${answeredCount}, Not answered: ${skippedCount}`);
            if (ok) void submit();
          }}>{saving ? "Submitting..." : "➤ Submit"}</button>
        </div>

        {error && <p className="bulk-message">{error}</p>}

        {flypastRun > 0 && (
          <div className="mu-test-flypast" key={flypastRun} aria-hidden="true">
            <span className="mu-test-flypast-plane">✈</span>
          </div>
        )}

        <div className="test-grid">
          <section className="panel question-panel mu-exam-question">
            <div className="question-meta mu-mobile-question-meta">
              <span className="mu-question-number-pill">Question {index + 1}</span>
              <button type="button" className={`mu-bookmark-button ${marked.includes(question.id) ? "is-marked" : ""}`} aria-label={marked.includes(question.id) ? "Remove bookmark" : "Mark for review"} onClick={() => toggleMark(question.id)}>{marked.includes(question.id) ? "🔖" : "♧"}</button>
              <span className="mu-question-status">{question.chapter || (answers[question.id] !== undefined ? "Answered" : "Not Answered")}</span>
            </div>

            <h2>{questionText}</h2>

            <div className="options">
              {options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  className={
                    "option " +
                    (answers[question.id] === i ? "selected" : "")
                  }
                  onClick={() =>
                    setAnswers((old) => ({
                      ...old,
                      [question.id]: i,
                    }))
                  }
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {option}
                </button>
              ))}
            </div>

            <div className="question-actions">
              <button
                className="btn secondary"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </button>

              <button
                className="btn secondary"
                onClick={() => toggleMark(question.id)}
              >
                {marked.includes(question.id)
                  ? "Remove Review"
                  : "Mark for Review"}
              </button>

              <button
                className="btn secondary"
                onClick={() =>
                  setAnswers((old) => {
                    const next = { ...old };
                    delete next[question.id];
                    return next;
                  })
                }
              >
                Clear Answer
              </button>

              <button
                className="btn primary"
                disabled={index === questions.length - 1}
                onClick={() =>
                  setIndex((i) => Math.min(questions.length - 1, i + 1))
                }
              >
                Save & Next
              </button>
            </div>
          </section>

          <aside className={`panel palette mu-exam-palette ${paletteOpen ? "is-open" : "is-collapsed"}`}>
            <div className="mu-palette-heading">
              <h3><span className="mu-palette-icon">▦</span> Question Palette</h3>
              <div className="mu-palette-legend">
                <span><i className="answered-dot" /> Answered</span>
                <span><i className="marked-dot" /> Marked</span>
                <span><i className="not-visited-dot" /> Not Visited</span>
              </div>
              <button type="button" className="mu-palette-toggle" aria-label={paletteOpen ? "Collapse question palette" : "Expand question palette"} onClick={() => setPaletteOpen((v) => !v)}>{paletteOpen ? "⌃" : "⌄"}</button>
            </div>

            {paletteOpen && <div className="palette-grid">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={[
                    index === i ? "current" : "",
                    answers[q.id] !== undefined ? "answered" : "",
                    marked.includes(q.id) ? "marked" : "",
                  ].join(" ")}
                >
                  {i + 1}
                </button>
              ))}
            </div>}

            <p className="legend mu-palette-mobile-stats">
              Answered: <b>{answeredCount}</b> · Marked: <b>{marked.length}</b> · Not Visited: <b>{skippedCount}</b>
            </p>

            <p>
              Answered: <b>{answeredCount}</b> / {questions.length}
            </p>
            <p>
              Not answered: <b>{skippedCount}</b>
            </p>
            <p>
              Marked for review: <b>{marked.length}</b>
            </p>

          </aside>
        </div>
      </section>
    </main>
  );
}