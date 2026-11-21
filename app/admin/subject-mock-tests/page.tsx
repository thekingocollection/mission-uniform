"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Subject = { id: string; name_en: string; name_hi: string | null };
type SubjectRow = Subject & { verifiedCount: number; test: Test | null };
type Test = { id: string; title: string; subject_id: string | null; status: string; total_questions: number; duration_minutes: number };

export default function SubjectMockTestsAdmin() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!sb) { setMessage("Supabase is not configured."); setLoading(false); return; }
    setLoading(true);
    setMessage("");
    const [subjectResult, testResult] = await Promise.all([
      sb.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en"),
      sb.from("test_papers").select("id,title,subject_id,status,total_questions,duration_minutes")
        .eq("question_mode", "subject_random").order("created_at", { ascending: false })
    ]);
    if (subjectResult.error || testResult.error) {
      setMessage(subjectResult.error?.message || testResult.error?.message || "Could not load subject mock tests.");
      setLoading(false);
      return;
    }
    const subjects = (subjectResult.data || []) as Subject[];
    const tests = (testResult.data || []) as Test[];
    const counts = await Promise.all(subjects.map(subject =>
      sb.from("questions").select("id", { count: "exact", head: true })
        .eq("subject_id", subject.id).eq("is_active", true).eq("verified", true)
    ));
    setRows(subjects.map((subject, index) => ({
      ...subject,
      verifiedCount: counts[index].count || 0,
      test: tests.find(test => test.subject_id === subject.id) || null
    })));
    const countError = counts.find(result => result.error)?.error;
    if (countError) setMessage("Question counts could not be loaded: " + countError.message);
    setLoading(false);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(test: Test, status: "published" | "draft" | "archived") {
    if (!sb) return;
    setBusyId(test.id);
    setMessage("");
    const { error } = await sb.from("test_papers").update({ status }).eq("id", test.id);
    if (error) setMessage("Status update failed: " + error.message);
    else setMessage(test.title + " is now " + status + ".");
    await load();
    setBusyId("");
  }

  const readyCount = rows.filter(row => row.verifiedCount >= 30).length;
  const publishedCount = rows.filter(row => row.test?.status === "published").length;

  return (
    <div className="admin-subject-mock">
      <div className="admin-page-heading">
        <div>
          <span className="admin-kicker">SUBJECT PRACTICE CONTROL</span>
          <h1>Subject-wise Mock Tests</h1>
          <p>Manage only the automatic 30-question random practice tests. Questions are taken from each subject’s active, verified Question Bank.</p>
        </div>
        <button className="admin-ghost" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="admin-stat-grid admin-subject-mock-stats">
        <div className="admin-stat-card"><small>Active Subjects</small><b>{loading ? "—" : rows.length}</b></div>
        <div className="admin-stat-card"><small>Ready (30+ verified)</small><b>{loading ? "—" : readyCount}</b></div>
        <div className="admin-stat-card"><small>Published Practice Tests</small><b>{loading ? "—" : publishedCount}</b></div>
      </div>

      {message && <p className="admin-inline-message bulk-message">{message}</p>}

      <section className="admin-panel">
        <div className="admin-panel-title">
          <div><h2>Subject Practice Manager</h2><p className="admin-muted">A subject becomes eligible after it has at least 30 active, verified questions.</p></div>
        </div>
        {loading ? <p className="admin-muted">Loading subjects and question counts…</p> :
          rows.length === 0 ? <p className="admin-muted">No active subjects found.</p> :
          <div className="admin-subject-mock-list">
            {rows.map(row => {
              const ready = row.verifiedCount >= 30;
              const test = row.test;
              return (
                <article className="admin-subject-mock-row" key={row.id}>
                  <div className="admin-subject-mock-info">
                    <h3>{row.name_en || row.name_hi || "Subject"}</h3>
                    {row.name_hi && row.name_hi !== row.name_en && <small>{row.name_hi}</small>}
                    <p>{row.verifiedCount} / 30 active verified questions</p>
                    <div className="admin-subject-progress"><span style={{ width: Math.min(100, row.verifiedCount / 30 * 100) + "%" }} /></div>
                  </div>
                  <div className="admin-subject-mock-meta">
                    <span className={"admin-pill " + (ready ? "active" : "blocked")}>{ready ? "Eligible" : "Need " + (30 - row.verifiedCount) + " more"}</span>
                    {test ? <>
                      <strong>{test.title}</strong>
                      <small>{test.total_questions} questions · {test.duration_minutes} minutes</small>
                      <span className={"admin-pill " + (test.status === "published" ? "active" : "blocked")}>{test.status}</span>
                      <div className="admin-actions">
                        {test.status !== "published" && <button disabled={busyId === test.id || !ready} onClick={() => void updateStatus(test, "published")}>Publish</button>}
                        {test.status !== "draft" && <button disabled={busyId === test.id} onClick={() => void updateStatus(test, "draft")}>Move to Draft</button>}
                        {test.status !== "archived" && <button className="danger" disabled={busyId === test.id} onClick={() => void updateStatus(test, "archived")}>Archive</button>}
                      </div>
                    </> : <small>{ready ? "Practice entry not found. Re-run the subject practice migration or check its trigger." : "Add and verify questions in Question Bank to unlock this test."}</small>}
                  </div>
                </article>
              );
            })}
          </div>
        }
      </section>
      <p className="admin-muted">Each student attempt gets a fresh random set of 30 questions. The same subject can be attempted unlimited times.</p>
    </div>
  );
}
