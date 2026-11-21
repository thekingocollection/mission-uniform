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

type ReviewItem = {
  id: string;
  question: string;
  options: string[];
  selected: number | null;
  correct_option: string;
  explanation: string;
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
  const [error, setError] = useState("");

  const submittedRef = useRef(false);
  const submitRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`/api/tests/${id}/questions`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Test load nahi hua.");

        if (active) {
          setTest(data.test);
          setQuestions(data.questions ?? []);
          setSeconds(Number(data.test.duration_minutes || 30) * 60);
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

  function getOptions(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === "string"
          ? item
          : String(item?.text ?? item?.value ?? "")
      );
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
        body: JSON.stringify({ answers, attempt_id: attemptId }),
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
      const response = await fetch(`/api/tests/${id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("Server response invalid. Please check and retry."); }
      if (!response.ok) throw new Error(data.error || "Test start nahi hua.");
      submittedRef.current = false;
      setAttemptId(data.attempt_id);
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
  const options = getOptions(question?.options);
  const answeredCount = Object.keys(answers).length;
  const skippedCount = questions.length - answeredCount;

  if (result) {
    const attempt = result.attempt;
    const review: ReviewItem[] = result.review || [];
    const item = review[reviewIndex];

    return (
      <main className="content-wrap">
        <section className="panel result-panel">
          <span className="eyebrow">MISSION UNIFORM OP · RESULT</span>
          <h1>Test Completed!</h1>

          <div className="score-ring">
            {attempt.score}
            <small> Score</small>
          </div>

          <div className="test-result-grid">
            <div><b>{result.total}</b><span>Total</span></div>
            <div><b>{attempt.correct_count}</b><span>Correct</span></div>
            <div><b>{attempt.wrong_count}</b><span>Wrong</span></div>
            <div><b>{attempt.skipped_count}</b><span>Skipped</span></div>
          </div>

          <p>Accuracy: <b>{result.accuracy}%</b></p>
          <p>Your result has been saved to your account.</p>
        </section>

        <section className="panel">
          <h2>Answer Review</h2>
          <p>Question {reviewIndex + 1} of {review.length}</p>

          {item && (
            <article className="review-item">
              <h3>{item.question}</h3>

              {item.options.map((option, i) => (
                <p
                  key={i}
                  className={
                    String(i) === String(item.selected)
                      ? "selected"
                      : ""
                  }
                >
                  {String.fromCharCode(65 + i)}. {option}
                  {String(i) === String(
                    ["A", "B", "C", "D"].indexOf(
                      String(item.correct_option).toUpperCase()
                    )
                  ) ? " ✓ Correct answer" : ""}
                </p>
              ))}

              <p>
                Your answer:{" "}
                {item.selected === null
                  ? "Not answered"
                  : item.options[item.selected]}
              </p>

              <p>
                Status: <b>{item.status.toUpperCase()}</b>
              </p>

              {item.explanation && (
                <p><b>Explanation:</b> {item.explanation}</p>
              )}
            </article>
          )}

          <div className="question-actions">
            <button
              className="btn secondary"
              disabled={reviewIndex === 0}
              onClick={() => setReviewIndex((i) => i - 1)}
            >
              Previous
            </button>

            <button
              className="btn primary"
              disabled={reviewIndex >= review.length - 1}
              onClick={() => setReviewIndex((i) => i + 1)}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!started) {
    return (
      <section className="panel test-intro">
        <span className="eyebrow">MISSION UNIFORM OP · EXAM MODE</span>
        <h1>{test.title}</h1>
        <p>{test.description}</p>

        <div className="test-result-grid">
          <div><b>{questions.length}</b><span>Questions</span></div>
          <div><b>{test.duration_minutes}</b><span>Minutes</span></div>
          <div><b>{test.marks_per_question}</b><span>Marks</span></div>
          <div><b>{test.negative_marking}</b><span>Negative</span></div>
        </div>

        <ul>
          <li>Har question ka ek correct answer select karein.</li>
          <li>Mark for Review se question baad mein dekh sakte hain.</li>
          <li>Time khatam hone par test automatically submit hoga.</li>
          <li>Submit ke baad answers change nahi kar sakte.</li>
        </ul>

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
    <main className="content-wrap">
      <section className="test-layout">
        <div className="test-top">
          <div>
            <span className="eyebrow">MISSION UNIFORM OP · LIVE EXAM</span>
            <h1>{test.title}</h1>
            <p>Question {index + 1} / {questions.length}</p>
          </div>

          <div className="timer">
            ⏱ {formatTime(seconds)}
          </div>
        </div>

        {error && <p className="bulk-message">{error}</p>}

        <div className="test-grid">
          <section className="panel question-panel">
            <div className="question-meta">
              <span>{question.chapter || "General"}</span>
              <span>{answers[question.id] !== undefined ? "Answered" : "Not Answered"}</span>
            </div>

            <h2>
              {question.question_hi ||
                question.question_or ||
                question.question_en}
            </h2>

            {question.question_en && question.question_hi && (
              <p className="muted">{question.question_en}</p>
            )}

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

          <aside className="panel palette">
            <h3>Question Palette</h3>

            <div className="palette-grid">
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
            </div>

            <p className="legend">
              🟢 Answered · ⚪ Not answered · 🟡 Review
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

            <button
              className="btn danger"
              disabled={saving}
              onClick={() => {
                const ok = window.confirm(
                  `Submit test now? Answered: ${answeredCount}, Not answered: ${skippedCount}`
                );
                if (ok) void submit();
              }}
            >
              {saving ? "Submitting..." : "Submit Test"}
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}