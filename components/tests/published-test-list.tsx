"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Paper = {
  id: string;
  title: string;
  description: string | null;
  test_type: string;
  chapter?: string | null;
  question_mode?: string;
  subject?: { name_en?: string | null; name_hi?: string | null } | null;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marking: number;
  is_previous_year?: boolean;
  exam_year?: number | null;
  exam_name?: string | null;
  session_label?: string | null;
};

const FILTERS = [
  ["all", "All Tests"],
  ["daily", "Daily"],
  ["subject", "Subject"],
  ["full", "Full Mock"],
  ["previous_year", "Previous Year"],
];

function typeLabel(test: Paper) {
  if (test.is_previous_year) return "Previous Year";
  const labels: Record<string, string> = {
    daily: "Daily Practice",
    subject: "Subject Test",
    chapter: "Chapter Test",
    full: "Full Mock",
    grand: "Grand Test",
  };
  return labels[test.test_type] || test.test_type.replaceAll("_", " ");
}

export default function PublishedTestList({ testType }: { testType?: string }) {
  const [tests, setTests] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function loadTests() {
    setLoading(true);
    setError("");
    try {
      const sb = supabaseBrowser();
      const { data: { session } } = sb
        ? await sb.auth.getSession()
        : { data: { session: null } };
      if (!session) throw new Error("Please login to view tests.");
      const response = await fetch(
        "/api/tests" + (testType ? "?type=" + encodeURIComponent(testType) : ""),
        { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tests could not be loaded.");
      setTests(data.tests || []);
    } catch (e: any) {
      setError(e.message || "Tests could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTests(); }, [testType]);

  // Only admin-published papers appear here. Subject-random practice remains on its dedicated page.
  const listedTests = tests.filter((t) => t.question_mode !== "subject_random");
  const visible = useMemo(() => listedTests.filter((t) => {
    if (filter === "all") return true;
    if (filter === "previous_year") return !!t.is_previous_year;
    return t.test_type === filter;
  }), [listedTests, filter]);

  const fullMocks = listedTests.filter((t) => t.test_type === "full" || t.test_type === "grand").length;

  return (
    <main className="mu-tests-simple">
      <section className="mu-tests-welcome">
        <div className="mu-tests-welcome-copy">
          <span className="mu-tests-eyebrow"><i /> MISSION UNIFORM OP · PRACTICE ARENA</span>
          <p className="mu-tests-welcome-label">YOUR NEXT STEP</p>
          <h1>Ready to test<br /><em>your preparation?</em></h1>
          <p className="mu-tests-intro">Choose a practice paper, attempt it with focus and improve with every test.</p>
          <div className="mu-tests-highlights">
            <span>✓ Exam-style questions</span>
            <span>◷ Timed practice</span>
          </div>
        </div>
        <div className="mu-tests-emblem" aria-hidden="true">
          <div><span>★</span><b>MU</b><small>UNIFORM OP</small></div>
          <p>PREPARE · PRACTISE · SUCCEED</p>
        </div>
        <div className="mu-tests-welcome-foot"><span>01 / SELECT</span><span>02 / ATTEMPT</span><span>03 / IMPROVE</span></div>
      </section>

      {!loading && !error && (
        <section className="mu-tests-summary" aria-label="Test summary">
          <div><b>{listedTests.length}</b><span>Available tests</span></div>
          <div><b>{fullMocks}</b><span>Full mock tests</span></div>
        </section>
      )}

      <section className="mu-tests-list-section">
        <div className="mu-tests-section-heading">
          <div><span>START PRACTISING</span><h2>Choose your test</h2><p>Select a category and begin.</p></div>
          <span className="mu-tests-count">{loading ? "Loading…" : error ? " " : visible.length + " TESTS"}</span>
        </div>

        {!testType && !loading && !error && (
          <div className="mu-tests-filters" role="group" aria-label="Test category">
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>
            ))}
          </div>
        )}

        {loading && <div className="mu-tests-message"><span className="mu-tests-spinner" /><b>Loading your practice tests…</b><p>Please wait a moment.</p></div>}
        {!loading && error && <div className="mu-tests-message is-error"><b>Tests could not be loaded</b><p>{error}</p><button type="button" onClick={() => void loadTests()}>Try Again</button></div>}
        {!loading && !error && visible.length === 0 && (
          <div className="mu-tests-message"><span className="mu-tests-empty">✦</span><b>No tests available in this category</b><p>Choose another category or check back soon.</p><button type="button" onClick={() => setFilter("all")}>Show All Tests</button></div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="mu-tests-cards">
            {visible.map((t, index) => (
              <article className="mu-tests-card" key={t.id}>
                <div className="mu-tests-card-top">
                  <span className="mu-tests-type">{typeLabel(t)}</span>
                  <span className="mu-tests-card-number">TEST {String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{t.title}</h3>
                {t.is_previous_year && <p className="mu-tests-year">{t.exam_name || "Previous Year Paper"}{t.exam_year ? " · " + t.exam_year : ""}{t.session_label ? " · " + t.session_label : ""}</p>}
                {t.subject && <p className="mu-tests-subject">{t.subject.name_en || t.subject.name_hi}</p>}
                <p className="mu-tests-description">{t.description || "Odisha Police exam practice paper. Attempt the test and review your performance."}</p>
                <div className="mu-tests-metrics">
                  <div><b>{t.total_questions}</b><span>Questions</span></div>
                  <div><b>{t.duration_minutes} min</b><span>Duration</span></div>
                  <div><b>{t.marks_per_question}</b><span>Marks / Q</span></div>
                </div>
                <div className="mu-tests-card-bottom"><span>Negative marking: <b>{t.negative_marking}</b></span></div>
                <Link className="mu-tests-start" href={"/tests/paper/" + t.id}>Start Test <span>→</span></Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
