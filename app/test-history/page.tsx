"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Attempt = {
  id: string;
  test_id: string;
  title: string;
  score: number;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  started_at: string | null;
  submitted_at: string;
};

export default function Page() {
  const router = useRouter();
  const [rows, setRows] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace("/login?next=/test-history");
        return;
      }

      const response = await fetch("/api/test-history", {
        headers: { Authorization: "Bearer " + session.access_token },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/login?next=/test-history");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Test history load nahi ho payi.");
      setRows(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load test history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const stats = useMemo(() => {
    const totalTests = rows.length;
    const totalQuestions = rows.reduce((sum, row) => sum + row.total, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    const averageAccuracy = totalQuestions ? Math.round(correct / totalQuestions * 100) : 0;
    const bestAccuracy = rows.reduce((best, row) => Math.max(best, row.accuracy), 0);
    return { totalTests, totalQuestions, averageAccuracy, bestAccuracy };
  }, [rows]);

  return (
    <main className="content-wrap" style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 16px 48px" }}>
      <section className="panel" style={{ padding: "clamp(20px,4vw,34px)", borderRadius: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow">MISSION UNIFORM OP · STUDENT PERFORMANCE</span>
            <h1 style={{ margin: "8px 0 5px" }}>My Test History</h1>
            <p className="muted" style={{ margin: 0 }}>Your submitted mock tests, scores and answer performance in one place.</p>
          </div>
          <button className="btn secondary" type="button" onClick={() => void loadHistory(true)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>

        {message && (
          <div role="alert" style={{ marginTop: 20, padding: 14, borderRadius: 10, border: "1px solid #efcaca", background: "#fff5f5", color: "#8b2525" }}>
            <b>History load nahi ho payi</b>
            <p style={{ margin: "5px 0 10px" }}>{message}</p>
            <button className="btn secondary" type="button" onClick={() => void loadHistory(true)}>Try again</button>
          </div>
        )}

        {loading ? (
          <p style={{ padding: 30, textAlign: "center" }}>Loading your submitted tests…</p>
        ) : !message && rows.length === 0 ? (
          <div style={{ marginTop: 24, padding: "34px 18px", textAlign: "center", borderRadius: 14, background: "#f5f8fa", border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: 34 }}>📝</div>
            <h2 style={{ margin: "10px 0 6px" }}>No completed tests yet</h2>
            <p className="muted">Once you submit a mock test, your score and performance will appear here automatically.</p>
            <Link className="btn primary" href="/tests">Explore Mock Tests →</Link>
          </div>
        ) : !message ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "24px 0" }}>
              {[
                { label: "Tests Completed", value: stats.totalTests },
                { label: "Questions Practised", value: stats.totalQuestions },
                { label: "Overall Accuracy", value: stats.averageAccuracy + "%" },
                { label: "Best Test Accuracy", value: stats.bestAccuracy + "%" },
              ].map((item) => (
                <div key={item.label} style={{ padding: 16, borderRadius: 12, background: "#f3f7fa", border: "1px solid #e0e8ee" }}>
                  <small style={{ color: "#64748b", fontWeight: 700 }}>{item.label}</small>
                  <div style={{ marginTop: 6, fontSize: 26, fontWeight: 850, color: "#173b50" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "24px 0 12px" }}>
              <h2 style={{ margin: 0 }}>Completed Test Attempts</h2>
              <span className="muted">{rows.length} result(s)</span>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                <thead>
                  <tr style={{ background: "#f4f7f9", textAlign: "left" }}>
                    {["Test", "Score", "Correct", "Wrong", "Skipped", "Accuracy", "Submitted"].map((heading) => (
                      <th key={heading} style={{ padding: "13px 12px", fontSize: 12, color: "#475569", whiteSpace: "nowrap" }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid #e8edf1" }}>
                      <td style={{ padding: 13, fontWeight: 700, color: "#173b50" }}>{row.title}</td>
                      <td style={{ padding: 13, whiteSpace: "nowrap" }}>{row.score} / {row.total}</td>
                      <td style={{ padding: 13, color: "#16804a" }}>{row.correct}</td>
                      <td style={{ padding: 13, color: "#b23b36" }}>{row.wrong}</td>
                      <td style={{ padding: 13 }}>{row.skipped}</td>
                      <td style={{ padding: 13 }}><b>{row.accuracy}%</b></td>
                      <td style={{ padding: 13, whiteSpace: "nowrap", fontSize: 13 }}>{new Date(row.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>Only successfully submitted tests are listed. In-progress tests are not counted as completed attempts.</p>
          </>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
          <Link className="btn primary" href="/tests">Take Another Mock Test →</Link>
          <Link className="btn secondary" href="/dashboard">Back to Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
