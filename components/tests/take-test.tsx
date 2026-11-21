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
  difficulty?: string | null;
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

type TestInfo = {
  id: string;
  title: string;
  description: string | null;
  test_type: string;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marking: number;
  question_mode: "bank" | "manual" | "pool";
  available_questions?: number;
};

type TestResult = {
  success: boolean;
  total: number;
  accuracy: number;
  attempt: {
    id: string;
    score: number;
    correct_count: number;
    wrong_count: number;
    skipped_count: number;
  };
  review: ReviewItem[];
};

export default function TakeTest({ id }: { id: string }) {
  const [test, setTest] = useState<TestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attemptId, setAttemptId] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [error, setError] = useState("");

  const submittedRef = useRef(false);
  const submitRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;

    async function loadTest() {
      try {
        const response = await fetch(`/api/tests/${id}/questions`);
        const text = await response.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(`Invalid server response (HTTP ${response.status}).`);
        }
        if (!response.ok) throw new Error(data.error || "Test load nahi hua.");
        if (!active) return;
        setTest(data.test);
        setSeconds(Number(data.test.duration_minutes || 30) * 60);
      } catch (e: any) {
        if (active) setError(e.message || "Test load nahi hua.");
      }
    }

    void loadTest();
    return () => { active = false; };
  }, [id]);

  function getOptions(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(item =>
        typeof item === "string" ? item : String(item?.text ?? item?.value ?? "")
      );
    }
    if (value && typeof value === "object") {
      return ["A", "B", "C", "D"].map(key => String(value[key] ?? ""));
    }
    return [];
  }

  async function startTest() {
    if (starting || started) return;
    setStarting(true);
    setError("");

    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase connection unavailable.");

      const { data: { session }, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Test start karne ke liye student login karein.");
      }

      const response = await fetch(`/api/tests/${id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Start response invalid (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      if (!response.ok) throw new Error(data?.error || "Test start nahi hua.");
      if (!data?.attempt_id || !Array.isArray(data.questions) || !data.questions.length) {
        throw new Error("Server ne test questions return nahi kiye.");
      }

      setAttemptId(data.attempt_id);
      setTest(data.test);
      setQuestions(data.questions);
      setAnswers({});
      setMarked([]);
      setIndex(0);
      setReviewIndex(0);
      submittedRef.current = false;
      setTimeUp(false);
      setSeconds(Number(data.test.duration_minutes || 30) * 60);
      setStarted(true);
    } catch (e: any) {
      setError(e.message || "Test start nahi hua.");
    } finally {
      setStarting(false);
    }
  }

  async function submit() {
    if (submittedRef.current || saving || result || !attemptId) return;
    submittedRef.current = true;
    setSaving(true);
    setError("");

    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase connection unavailable.");
      const { data: { session }, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !session) throw new Error("Result save karne ke liye login karein.");

      const response = await fetch(`/api/tests/${id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ attempt_id: attemptId, answers })
      });

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Submit response invalid (HTTP ${response.status}): ${text.slice(0, 250) || "Empty response"}`);
      }

      if (!response.ok) throw new Error(data?.error || `Submit failed (HTTP ${response.status}).`);
      if (!data?.attempt) throw new Error("Server returned an invalid result.");
      setResult(data as TestResult);
    } catch (e: any) {
      submittedRef.current = false;
      setError(e.message || "Result save nahi hua.");
    } finally {
      setSaving(false);
    }
  }

  submitRef.current = submit;

  useEffect(() => {
    if (!started || result || timeUp) return;

    const timer = window.setInterval(() => {
      setSeconds(current => {
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
    if (timeUp && !result) void submitRef.current();
  }, [timeUp, result]);

  function formatTime(value: number) {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function toggleMark(questionId: string) {
    setMarked(old =>
      old.includes(questionId)
        ? old.filter(x => x !== questionId)
        : [...old, questionId]
    );
  }

  if (error && !test) {
    return (
      <section className="panel">
        <h2>Unable to Load Test</h2>
        <p>{error}</p>
        <button className="btn secondary" onClick={() => window.location.reload()}>Try Again</button>
      </section>
    );
  }

  if (!test) {
    return <section className="panel"><h2>Loading Mock Test...</h2></section>;
  }

  if (result) {
    const review = result.review || [];
    const item = review[reviewIndex];

    return (
      <main className="content-wrap">
        <section className="panel result-panel">
          <span className="eyebrow">MISSION UNIFORM OP · RESULT</span>
          <h1>Test Completed!</h1>
          <div className="score-ring">
            {result.attempt.score}
            <small> Score</small>
          </div>
          <div className="test-result-grid">
            <div><b>{result.total}</b><span>Total</span></div>
            <div><b>{result.attempt.correct_count}</b><span>Correct</span></div>
            <div><b>{result.attempt.wrong_count}</b><span>Wrong</span></div>
            <div><b>{result.attempt.skipped_count}</b><span>Skipped</span></div>
          </div>
          <p>Accuracy: <b>{result.accuracy}%</b></p>
          <p>Your result has been securely saved to your account.</p>
        </section>

        <section className="panel">
          <h2>Answer Review</h2>
          <p>Question {review.length ? reviewIndex + 1 : 0} of {review.length}</p>

          {item && (
            <article className="review-item">
              <h3>{item.question}</h3>
              {item.options.map((option, i) => {
                const correctIndex = ["A", "B", "C", "D"].indexOf(
                  String(item.correct_option).toUpperCase()
                );
                const isCorrect = i === correctIndex;
                const isSelected = i === item.selected;
                return (
                  <p key={i} className={[
                    isCorrect ? "correct" : "",
                    isSelected && !isCorrect ? "incorrect" : ""
                  ].join(" ")}>
                    {String.fromCharCode(65 + i)}. {option}
                    {isCorrect ? " ✓ Correct answer" : ""}
                    {isSelected && !isCorrect ? " · Your answer" : ""}
                  </p>
                );
              })}
              <p>
                Your answer:{" "}
                {item.selected === null ? "Not answered" : item.options[item.selected] || "Not available"}
              </p>
              <p>Status: <b>{item.status.toUpperCase()}</b></p>
              {item.explanation && <p><b>Explanation:</b> {item.explanation}</p>}
            </article>
          )}

          <div className="question-actions">
            <button className="btn secondary" disabled={reviewIndex === 0 || !review.length}
              onClick={() => setReviewIndex(i => i - 1)}>Previous</button>
            <button className="btn primary" disabled={reviewIndex >= review.length - 1}
              onClick={() => setReviewIndex(i => i + 1)}>Next</button>
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
          <div><b>{test.total_questions}</b><span>Questions</span></div>
          <div><b>{test.duration_minutes}</b><span>Minutes</span></div>
          <div><b>{test.marks_per_question}</b><span>Marks</span></div>
          <div><b>{test.negative_marking}</b><span>Negative</span></div>
        </div>
        {test.question_mode === "pool" && (
          <p>Random Question Pool · New unseen questions are selected for your account.</p>
        )}
        {test.question_mode === "manual" && (
          <p>Fixed uploaded paper · Every student receives the same questions.</p>
        )}
        <ul>
          <li>Har question ka ek correct answer select karein.</li>
          <li>Mark for Review se question baad mein dekh sakte hain.</li>
          <li>Time khatam hone par test automatically submit hoga.</li>
          <li>Submit ke baad answers change nahi kar sakte.</li>
        </ul>
        {error && <p className="bulk-message">{error}</p>}
        <button className="btn primary" disabled={starting} onClick={() => void startTest()}>
          {starting ? "Preparing Your Questions..." : "Start Mock Test"}
        </button>
      </section>
    );
  }

  if (!questions.length) {
    return <section className="panel"><h2>No questions were assigned to this attempt.</h2></section>;
  }

  const question = questions[index];
  if (!question) return <section className="panel"><h2>Question unavailable.</h2></section>;

  const options = getOptions(question.options);
  const answeredCount = Object.keys(answers).length;
  const skippedCount = questions.length - answeredCount;

  return (
    <main className="content-wrap">
      <section className="test-layout">
        <div className="test-top">
          <div>
            <span className="eyebrow">MISSION UNIFORM OP · LIVE EXAM</span>
            <h1>{test.title}</h1>
            <p>Question {index + 1} / {questions.length}</p>
          </div>
          <div className="timer">⏱ {formatTime(seconds)}</div>
        </div>

        {error && <p className="bulk-message">{error}</p>}

        <div className="test-grid">
          <section className="panel question-panel">
            <div className="question-meta">
              <span>{question.chapter || "General"}</span>
              <span>{answers[question.id] !== undefined ? "Answered" : "Not Answered"}</span>
            </div>

            <h2>{question.question_hi || question.question_or || question.question_en}</h2>
            {question.question_en && question.question_hi && (
              <p className="muted">{question.question_en}</p>
            )}

            <div className="options">
              {options.map((option, i) => (
                <button key={i} type="button"
                  className={"option " + (answers[question.id] === i ? "selected" : "")}
                  onClick={() => setAnswers(old => ({ ...old, [question.id]: i }))}>
                  <span>{String.fromCharCode(65 + i)}</span>
                  {option}
                </button>
              ))}
            </div>

            <div className="question-actions">
              <button className="btn secondary" disabled={index === 0}
                onClick={() => setIndex(i => i - 1)}>Previous</button>
              <button className="btn secondary" onClick={() => toggleMark(question.id)}>
                {marked.includes(question.id) ? "Remove Review" : "Mark for Review"}
              </button>
              <button className="btn secondary" onClick={() => setAnswers(old => {
                const next = { ...old };
                delete next[question.id];
                return next;
              })}>Clear Answer</button>
              <button className="btn primary" disabled={index === questions.length - 1}
                onClick={() => setIndex(i => Math.min(questions.length - 1, i + 1))}>Save & Next</button>
            </div>
          </section>

          <aside className="panel palette">
            <h3>Question Palette</h3>
            <div className="palette-grid">
              {questions.map((q, i) => (
                <button key={q.id} type="button" onClick={() => setIndex(i)}
                  className={[
                    index === i ? "current" : "",
                    answers[q.id] !== undefined ? "answered" : "",
                    marked.includes(q.id) ? "marked" : ""
                  ].join(" ")}>
                  {i + 1}
                </button>
              ))}
            </div>
            <p className="legend">🟢 Answered · ⚪ Not answered · 🟡 Review</p>
            <p>Answered: <b>{answeredCount}</b> / {questions.length}</p>
            <p>Not answered: <b>{skippedCount}</b></p>
            <p>Marked for review: <b>{marked.length}</b></p>
            <button className="btn danger" disabled={saving}
              onClick={() => {
                const ok = window.confirm(
                  `Submit test now? Answered: ${answeredCount}, Not answered: ${skippedCount}`
                );
                if (ok) void submit();
              }}>
              {saving ? "Submitting..." : "Submit Test"}
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
