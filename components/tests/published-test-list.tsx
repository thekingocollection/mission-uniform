"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Paper = {
  id: string; title: string; description: string | null; test_type: string;
  question_mode?: string; subject?: { name_en?: string | null; name_hi?: string | null } | null;
  duration_minutes: number; total_questions: number; marks_per_question: number;
  negative_marking: number; is_previous_year?: boolean; exam_year?: number | null;
  exam_name?: string | null; session_label?: string | null; source_label?: string | null;
};

const FILTERS = [
  ["all", "All tests"], ["daily", "Daily"], ["subject", "Subject"],
  ["chapter", "Chapter"], ["full", "Full mock"], ["grand", "Grand test"],
  ["previous_year", "Previous year"],
];

function typeLabel(test: Paper) {
  if (test.is_previous_year) return "Previous year paper";
  const labels: Record<string, string> = {
    daily: "Daily practice", subject: "Subject test", chapter: "Chapter test",
    full: "Full mock test", grand: "Grand test",
  };
  return labels[test.test_type] || test.test_type.replaceAll("_", " ");
}

export default function PublishedTestList({ testType }: { testType?: string }) {
  const [tests, setTests] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  async function loadTests() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tests" + (testType ? "?type=" + encodeURIComponent(testType) : ""), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tests load nahi hue.");
      setTests(data.tests || []);
    } catch (e: any) {
      setError(e.message || "Tests load nahi hue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTests(); }, [testType]);

  // Admin-published papers only. Subject-random practice stays on the separate Mock Test page.
  const listedTests = tests.filter(t => t.question_mode !== "subject_random");
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = listedTests.filter(t => {
      const matchesType = filter === "all" || (filter === "previous_year" ? !!t.is_previous_year : t.test_type === filter);
      const haystack = [t.title, t.description, t.subject?.name_en, t.subject?.name_hi, t.exam_name, t.exam_year, t.chapter].join(" ").toLowerCase();
      return matchesType && (!q || haystack.includes(q));
    });
    return [...filtered].sort((a, b) => {
      if (sort === "shortest") return a.duration_minutes - b.duration_minutes;
      if (sort === "questions") return b.total_questions - a.total_questions;
      return 0;
    });
  }, [listedTests, filter, search, sort]);

  const totalQuestions = listedTests.reduce((sum, t) => sum + Number(t.total_questions || 0), 0);
  const fullMocks = listedTests.filter(t => t.test_type === "full" || t.test_type === "grand").length;

  return (
    <section className="mu-published-catalog" aria-label="Published mock tests">
      <div className="mu-catalog-intro">
        <div><span className="mu-catalog-kicker">YOUR EXAM PRACTICE CENTRE</span><h2>Choose a test. Build your confidence.</h2><p>Admin-published practice papers, organised so you can quickly find the right test and start preparing.</p></div>
        <div className="mu-catalog-emblem" aria-hidden="true"><b>MU</b><span>✦</span></div>
      </div>

      {!loading && !error && <div className="mu-catalog-stats">
        <div><b>{listedTests.length}</b><span>Published tests</span></div>
        <div><b>{totalQuestions.toLocaleString("en-IN")}</b><span>Practice questions</span></div>
        <div><b>{fullMocks}</b><span>Full / grand mocks</span></div>
      </div>}

      {!testType && <div className="mu-catalog-toolbar">
        <div className="mu-catalog-filters" role="group" aria-label="Filter tests">
          {FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? "active" : ""} aria-pressed={filter === value}>{label}</button>)}
        </div>
        <div className="mu-catalog-controls">
          <label className="mu-catalog-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search test, subject or year…" aria-label="Search tests" /><kbd>SEARCH</kbd></label>
          <label className="mu-catalog-sort"><span>Sort</span><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort tests"><option value="newest">Newest first</option><option value="shortest">Shortest duration</option><option value="questions">Most questions</option></select></label>
        </div>
      </div>}

      <div className="mu-catalog-results-head"><div><b>{loading ? "Loading tests…" : error ? "Unable to load tests" : "Available tests"}</b><span>{!loading && !error ? `${visible.length} of ${listedTests.length} tests` : "Please wait"}</span></div><span className="mu-catalog-live"><i/> LIVE CATALOGUE</span></div>

      {loading && <div className="mu-catalog-state"><span className="mu-catalog-spinner"/> <b>Preparing your test catalogue</b><p>Published mock tests are loading…</p></div>}
      {!loading && error && <div className="mu-catalog-state is-error"><b>We couldn’t load the tests</b><p>{error}</p><button type="button" onClick={() => void loadTests()}>Try again</button></div>}
      {!loading && !error && visible.length === 0 && <div className="mu-catalog-state"><span className="mu-catalog-empty-icon">⌕</span><b>{search ? "No matching tests found" : "No tests published yet"}</b><p>{search ? "Try a different test name, subject or year." : "New practice papers will appear here as soon as the Admin publishes them."}</p>{search && <button type="button" onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>}</div>}

      {!loading && !error && visible.length > 0 && <div className="mu-catalog-grid">{visible.map((t, index) => (
        <article className="mu-catalog-card" key={t.id}>
          <div className="mu-catalog-card-top"><span className="mu-catalog-type">{typeLabel(t)}</span><span className="mu-catalog-number">TEST {String(index + 1).padStart(2, "0")}</span></div>
          <h3>{t.title}</h3>
          {t.is_previous_year && <p className="mu-catalog-year">{t.exam_name || "Previous Year Paper"}{t.exam_year ? " · " + t.exam_year : ""}{t.session_label ? " · " + t.session_label : ""}</p>}
          {t.subject && <p className="mu-catalog-subject">{t.subject.name_en || t.subject.name_hi}</p>}
          <p className="mu-catalog-description">{t.description || "Odisha Police exam practice paper. Attempt the test and review your performance."}</p>
          <div className="mu-catalog-metrics">
            <div><b>{t.total_questions}</b><span>Questions</span></div>
            <div><b>{t.duration_minutes} min</b><span>Duration</span></div>
            <div><b>{t.marks_per_question}</b><span>Marks / Q</span></div>
          </div>
          <div className="mu-catalog-card-foot"><span>Negative marking <b>{t.negative_marking}</b></span>{t.is_previous_year && <span className="mu-catalog-verified">✓ Admin verified</span>}</div>
          <Link className="mu-catalog-start" href={"/tests/paper/" + t.id}><span><small>READY WHEN YOU ARE</small><b>Start test</b></span><i>→</i></Link>
        </article>
      ))}</div>}
    </section>
  );
}
