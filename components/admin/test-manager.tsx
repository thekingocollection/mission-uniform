"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Subject = {
  id: string;
  name_en: string | null;
  name_hi: string | null;
  name_or: string | null;
};

type BankQuestion = {
  id: string;
  chapter: string | null;
  question_hi: string | null;
  question_or: string | null;
  question_en: string | null;
  subject_id: string;
};

type UploadedQuestion = {
  question_hi: string;
  question_or: string | null;
  question_en: string | null;
  options: string[];
  correct_option: string;
  explanation_hi: string | null;
  explanation_or: string | null;
  explanation_en: string | null;
  chapter: string | null;
  difficulty: string;
};

type PreviewRow = {
  row: number;
  question: string;
  errors: string[];
  payload: UploadedQuestion | null;
};

const cleanKey = (value: string) =>
  value.trim().toLowerCase().replace(/[\s-]+/g, "_");

export default function TestManager() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [tests, setTests] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("daily");
  const [mode, setMode] = useState<"bank" | "manual" | "pool">("manual");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [count, setCount] = useState(50);
  const [marks, setMarks] = useState(1);
  const [negative, setNegative] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("draft");

  const [uploadName, setUploadName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!sb) return;

    const [subjectResult, questionResult, testResult] = await Promise.all([
      sb.from("subjects")
        .select("id,name_en,name_hi,name_or")
        .eq("is_active", true)
        .order("name_en"),
      sb.from("questions")
        .select("id,chapter,question_hi,question_or,question_en,subject_id")
        .eq("is_active", true)
        .eq("verified", true)
        .limit(2000),
      sb.from("test_papers")
        .select("id,title,test_type,duration_minutes,total_questions,negative_marking,status,question_mode,created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    ]);

    if (subjectResult.error) throw subjectResult.error;
    if (questionResult.error) throw questionResult.error;
    if (testResult.error) throw testResult.error;

    setSubjects(subjectResult.data ?? []);
    setBankQuestions(questionResult.data ?? []);
    setTests(testResult.data ?? []);
  }

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        await load();
      } catch (e: any) {
        if (alive) setMessage(e.message || "Admin data load nahi hua.");
      }
    }
    void init();
    return () => { alive = false; };
  }, [sb]);

  const filteredQuestions = bankQuestions.filter(q =>
    (!subject || q.subject_id === subject) &&
    (!chapter || q.chapter === chapter)
  );

  const chapters = [
    ...new Set(
      bankQuestions
        .filter(q => !subject || q.subject_id === subject)
        .map(q => q.chapter)
        .filter(Boolean)
    )
  ] as string[];

  function resetUpload() {
    setUploadName("");
    setPreview([]);
  }

  function downloadTemplate() {
    const headers = [
      "question_hi", "question_or", "question_en",
      "option_a", "option_b", "option_c", "option_d",
      "correct_option", "explanation_hi", "explanation_or",
      "explanation_en", "chapter", "difficulty"
    ];
    const sample = [
      "भारत का संविधान कब लागू हुआ?", "",
      "When did the Constitution of India come into effect?",
      "15 August 1947", "26 January 1950", "26 November 1949",
      "2 October 1950", "B",
      "भारत का संविधान 26 जनवरी 1950 को लागू हुआ.", "", "",
      "भारतीय संविधान", "easy"
    ];

    const sheet = XLSX.utils.aoa_to_sheet([headers, sample]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Questions");
    XLSX.writeFile(book, "MISSION_UNIFORM_OP_Manual_Pool_Question_Template.xlsx");
  }

  async function readUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setPreview([]);
    setUploadName(file.name);

    try {
      const maxBytes = mode === "pool" ? 12 * 1024 * 1024 : 5 * 1024 * 1024;
      const maxRows = mode === "pool" ? 10000 : 300;

      if (file.size > maxBytes) {
        throw new Error(`File size limit: ${mode === "pool" ? "12 MB" : "5 MB"}.`);
      }

      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("Excel sheet not found.");

      const records = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, {
        defval: "",
        raw: false
      });

      if (!records.length) throw new Error("File mein questions nahi mile.");
      if (records.length > maxRows) {
        throw new Error(`Maximum ${maxRows} questions allowed per upload.`);
      }

      const rows: PreviewRow[] = records.map((raw, index) => {
        const data: Record<string, string> = {};
        Object.entries(raw).forEach(([key, value]) => {
          data[cleanKey(key)] = String(value ?? "").trim();
        });

        const options = [
          data.option_a || "",
          data.option_b || "",
          data.option_c || "",
          data.option_d || ""
        ];
        const correctMap: Record<string, string> = {
          A: "A", B: "B", C: "C", D: "D",
          "1": "A", "2": "B", "3": "C", "4": "D"
        };
        const correct = correctMap[(data.correct_option || "").toUpperCase()] || "";
        const errors: string[] = [];

        if (!data.question_hi) errors.push("Hindi question required.");
        if (options.some(x => !x)) errors.push("All four options are required.");
        if (!correct) errors.push("Correct option must be A/B/C/D or 1/2/3/4.");

        const payload: UploadedQuestion | null = errors.length ? null : {
          question_hi: data.question_hi,
          question_or: data.question_or || null,
          question_en: data.question_en || null,
          options,
          correct_option: correct,
          explanation_hi: data.explanation_hi || null,
          explanation_or: data.explanation_or || null,
          explanation_en: data.explanation_en || null,
          chapter: data.chapter || chapter || null,
          difficulty: ["easy", "medium", "hard"].includes((data.difficulty || "").toLowerCase())
            ? data.difficulty.toLowerCase()
            : "medium"
        };

        return {
          row: index + 2,
          question: data.question_hi || data.question_en || "(Question missing)",
          errors,
          payload
        };
      });

      setPreview(rows);
      const valid = rows.filter(row => row.payload).length;
      setMessage(`${rows.length} rows read: ${valid} valid, ${rows.length - valid} need correction.`);
      if (mode === "manual") setCount(valid);
    } catch (e: any) {
      setMessage(e.message || "Excel/CSV read nahi ho paya.");
      setPreview([]);
    }
  }

  async function saveTest() {
    if (!sb) return;
    setMessage("");

    if (!title.trim()) {
      setMessage("Test title enter karein.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) {
      setMessage("Duration 1 se 300 minutes ke beech honi chahiye.");
      return;
    }

    const uploaded = preview
      .filter(row => row.payload)
      .map(row => row.payload as UploadedQuestion);

    if (mode === "bank" && selected.length !== count) {
      setMessage(`Exactly ${count} verified Question Bank questions select karein.`);
      return;
    }
    if (mode === "manual" && (uploaded.length !== count || uploaded.length === 0)) {
      setMessage("Manual test ke liye valid uploaded question count test count ke barabar hona chahiye.");
      return;
    }
    if (mode === "pool" && (uploaded.length < count || uploaded.length === 0)) {
      setMessage(`Pool mein kam se kam ${count} valid questions hone chahiye.`);
      return;
    }
    if (!Number.isFinite(marks) || marks < 0 || !Number.isFinite(negative) || negative < 0) {
      setMessage("Marks aur negative marking valid number hone chahiye.");
      return;
    }

    setBusy(true);

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Admin session nahi mila. Dobara login karein.");

      const response = await fetch("/api/tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          test_type: type,
          question_mode: mode,
          subject_id: subject || null,
          chapter: chapter || null,
          duration_minutes: minutes,
          total_questions: count,
          marks_per_question: marks,
          negative_marking: negative,
          status,
          question_ids: mode === "bank" ? selected.slice(0, count) : [],
          question_payloads: mode === "bank" ? undefined : uploaded,
          pool_title: title.trim()
        })
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(`Server returned invalid response (HTTP ${response.status}). ${responseText.slice(0, 200)}`);
      }
      if (!response.ok) throw new Error(data.error || "Test save failed.");

      setMessage(
        mode === "pool"
          ? `Question Pool created with ${uploaded.length} questions. Test saved successfully.`
          : mode === "manual"
            ? `Manual test created with ${uploaded.length} uploaded questions.`
            : "Question Bank test saved successfully."
      );
      setTitle("");
      setDescription("");
      setSelected([]);
      resetUpload();
      await load();
    } catch (e: any) {
      setMessage(e.message || "Test save nahi hua.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string, next: string) {
    if (!sb) return;

    setBusy(true);
    setMessage("");

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Admin session nahi mila.");

      const response = await fetch(`/api/tests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Status update failed.");

      setMessage("Test status updated.");
      await load();
    } catch (e: any) {
      setMessage(e.message || "Status update failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!sb) return <section className="panel">Supabase browser configuration missing.</section>;

  return (
    <div className="admin-tests-page">
      <section className="panel">
        <span className="eyebrow">MISSION UNIFORM OP · TEST CONTROL</span>
        <h1>Mock Test Builder</h1>
        <p>Create a fixed paper, upload its own questions, or build a large random question pool.</p>

        {message && <div className="notice" role="status">{message}</div>}

        <label>
          Test title
          <input className="input" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Odisha Police Full Mock 01" />
        </label>

        <label>
          Test description
          <textarea className="input" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Test instructions / details" rows={2} />
        </label>

        <div className="form-grid">
          <label>
            Test type
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              {["daily", "subject", "chapter", "full", "grand"].map(x =>
                <option key={x} value={x}>{x}</option>
              )}
            </select>
          </label>

          <label>
            Question source
            <select className="input" value={mode} onChange={e => {
              setMode(e.target.value as "bank" | "manual" | "pool");
              setSelected([]);
              resetUpload();
              setCount(e.target.value === "pool" ? 50 : 10);
            }}>
              <option value="manual">Manual upload – fixed questions</option>
              <option value="pool">Random Pool – new questions per attempt</option>
              <option value="bank">Existing Question Bank</option>
            </select>
          </label>

          <label>
            Subject (optional)
            <select className="input" value={subject} onChange={e => {
              setSubject(e.target.value);
              setChapter("");
              setSelected([]);
            }}>
              <option value="">All subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name_en || s.name_hi || s.name_or}</option>
              ))}
            </select>
          </label>

          <label>
            Chapter (optional)
            <select className="input" value={chapter} onChange={e => setChapter(e.target.value)}>
              <option value="">All chapters</option>
              {chapters.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label>
            Duration (minutes)
            <input className="input" type="number" min="1" max="300" value={minutes}
              onChange={e => setMinutes(Number(e.target.value))} />
          </label>

          <label>
            Questions shown per test
            <input className="input" type="number" min="1" max="300" value={count}
              onChange={e => setCount(Number(e.target.value))} />
          </label>

          <label>
            Marks per question
            <input className="input" type="number" min="0" step="0.25" value={marks}
              onChange={e => setMarks(Number(e.target.value))} />
          </label>

          <label>
            Negative marking
            <input className="input" type="number" min="0" step="0.25" value={negative}
              onChange={e => setNegative(Number(e.target.value))} />
          </label>

          <label>
            Initial status
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>

        {mode === "bank" ? (
          <>
            <h3>Question Bank selection ({selected.length} selected / {filteredQuestions.length} available)</h3>
            <div className="question-select-list">
              {filteredQuestions.map((q, i) => (
                <label key={q.id} className="question-select-row">
                  <input type="checkbox" checked={selected.includes(q.id)}
                    onChange={e => setSelected(old =>
                      e.target.checked
                        ? [...old, q.id]
                        : old.filter(x => x !== q.id)
                    )} />
                  <span>
                    <b>{i + 1}. {q.question_hi || q.question_or || q.question_en || "Question text missing"}</b>
                    <small>{q.chapter || "No chapter"} · {q.id.slice(0, 8)}</small>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>{mode === "pool" ? "Upload your large question pool" : "Upload this test's own questions"}</h3>
            <p>
              {mode === "pool"
                ? "Upload 1,000 or more questions. Every student gets the selected number in randomized order, with no repeat for that student until the pool cycle finishes."
                : "Upload exactly the number of questions configured above. This test uses only this uploaded paper, not the Question Bank."}
            </p>

            <button className="btn secondary" type="button" onClick={downloadTemplate}>
              Download Excel / CSV Template
            </button>

            <label>
              Select Excel or CSV
              <input type="file" accept=".xlsx,.xls,.csv" onChange={readUpload} />
            </label>

            {uploadName && <p>File: <b>{uploadName}</b></p>}

            {preview.length > 0 && (
              <>
                <div className="bulk-summary">
                  <span>Total uploaded: <b>{preview.length}</b></span>
                  <span>Valid: <b>{preview.filter(x => x.payload).length}</b></span>
                  <span>Errors: <b>{preview.filter(x => x.errors.length).length}</b></span>
                </div>

                <div className="bulk-table-wrap">
                  <table className="bulk-table">
                    <thead>
                      <tr><th>Row</th><th>Question</th><th>Validation</th></tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 100).map(row => (
                        <tr key={row.row}>
                          <td>{row.row}</td>
                          <td>{row.question}</td>
                          <td>{row.errors.length ? row.errors.join(" ") : "Ready"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 100 && <p className="muted">First 100 rows shown in preview. All rows will be imported after validation.</p>}
                </div>
              </>
            )}
          </>
        )}

        <button className="btn primary" disabled={busy} onClick={() => void saveTest()}>
          {busy ? "Saving..." : "Save Mock Test"}
        </button>
      </section>

      <section className="panel">
        <h2>Existing Test Papers</h2>
        {tests.length === 0 ? (
          <p>No test papers yet.</p>
        ) : tests.map(t => (
          <article className="review-item" key={t.id}>
            <b>{t.title}</b>
            <p>
              {t.test_type} · {t.question_mode || "bank"} · {t.duration_minutes} min ·
              {" "}{t.total_questions} questions · {t.status}
            </p>
            <div className="result-actions">
              {t.status !== "published" && (
                <button className="btn primary" disabled={busy}
                  onClick={() => void updateStatus(t.id, "published")}>Publish</button>
              )}
              {t.status !== "archived" && (
                <button className="btn secondary" disabled={busy}
                  onClick={() => void updateStatus(t.id, "archived")}>Archive</button>
              )}
              {t.status === "archived" && (
                <button className="btn secondary" disabled={busy}
                  onClick={() => void updateStatus(t.id, "draft")}>Restore draft</button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
