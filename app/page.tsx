
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type TestPaper = {
  id: string;
  title: string;
  description: string | null;
  test_type: string;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marking: number;
  status: string;
};

export default function StudentTestsPage() {
  const [tests, setTests] = useState<TestPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTests() {
      try {
        const supabase = supabaseBrowser();

        if (!supabase) {
          throw new Error("Supabase configuration missing.");
        }

        const { data, error } = await supabase
          .from("test_papers")
          .select(
            "id, title, description, test_type, duration_minutes, total_questions, marks_per_question, negative_marking, status"
          )
          .eq("status", "published")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (active) {
          setTests((data || []) as TestPaper[]);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load mock tests."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTests();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="student-tests-page">
      <section className="student-tests-hero">
        <span className="eyebrow">MISSION UNIFORM OP</span>
        <h1>Mock Tests</h1>
        <p>
          Practice for Odisha Police and other government
          examinations. Attempt published tests and improve
          your preparation.
        </p>
        <div className="student-test-count">
          {tests.length} Published Tests
        </div>
      </section>

      <section className="student-tests-section">
        <div className="student-tests-heading">
          <div>
            <span className="eyebrow">YOUR PRACTICE ZONE</span>
            <h2>Available Mock Tests</h2>
          </div>
          <button
            className="student-refresh-btn"
            onClick={() => window.location.reload()}
          >
            ↻ Refresh
          </button>
        </div>

        {loading && (
          <div className="student-test-message">
            Loading published tests...
          </div>
        )}

        {!loading && error && (
          <div className="student-test-error">
            <h3>Unable to load tests</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && tests.length === 0 && (
          <div className="student-test-empty">
            <div className="empty-icon">📝</div>
            <h3>No Published Tests Yet</h3>
            <p>
              New mock tests will appear here when the
              administrator publishes them.
            </p>
          </div>
        )}

        {!loading && !error && tests.length > 0 && (
          <div className="student-test-grid">
            {tests.map((test) => (
              <article className="student-test-card" key={test.id}>
                <div className="student-test-card-top">
                  <span className="student-test-tag">
                    {test.test_type?.replaceAll("_", " ") || "MOCK TEST"}
                  </span>
                  <span className="student-published-tag">
                    Published
                  </span>
                </div>

                <h3>{test.title}</h3>

                <p className="student-test-description">
                  {test.description || "Practice this test to improve your exam preparation."}
                </p>

                <div className="student-test-meta">
                  <div>
                    <strong>{test.total_questions}</strong>
                    <span>Questions</span>
                  </div>
                  <div>
                    <strong>{test.duration_minutes} min</strong>
                    <span>Duration</span>
                  </div>
                  <div>
                    <strong>{test.marks_per_question}</strong>
                    <span>Marks / Q</span>
                  </div>
                </div>

                <div className="student-test-negative">
                  Negative marking: {test.negative_marking}
                </div>

                <Link
                  href={`/tests/${test.id}`}
                  className="student-start-test"
                >
                  Start Test →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
