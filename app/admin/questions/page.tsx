
"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Subject = {
  id: string;
  name_en: string;
  name_hi: string | null;
};

type Chapter = {
  id: string;
  subject_id: string;
  name: string;
};

type Question = {
  id: string;
  subject_id: string | null;
  chapter: string | null;
  question_hi: string;
  question_or: string | null;
  question_en: string | null;
  options: any;
  correct_option: string;
  difficulty: string;
  verified: boolean;
  is_active: boolean;
  created_at: string;
};

const normalize = (value: unknown) =>
  String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

export default function AdminQuestions() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadData() {
    if (!supabase) return;

    const [subjectResult, chapterResult, questionResult] =
      await Promise.all([
        supabase.from("subjects")
          .select("id,name_en,name_hi")
          .eq("is_active", true)
          .order("name_en"),

        supabase.from("chapters")
          .select("id,subject_id,name")
          .eq("is_active", true)
          .order("sort_order"),

        supabase.from("questions")
          .select("id,subject_id,chapter,question_hi,question_or,question_en,options,correct_option,difficulty,verified,is_active,created_at")
          .order("created_at", { ascending: false })
          .limit(500)
      ]);

    if (subjectResult.error) throw subjectResult.error;
    if (chapterResult.error) throw chapterResult.error;
    if (questionResult.error) throw questionResult.error;

    setSubjects(subjectResult.data || []);
    setChapters(chapterResult.data || []);
    setQuestions(questionResult.data || []);
  }

  useEffect(() => {
    let alive = true;

    async function init() {
      if (!supabase) {
        setAuthorized(false);
        setMessage("Supabase is not configured.");
        return;
      }

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setAuthorized(false);
        setMessage("Please sign in first.");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      const allowed = !error && profile?.role === "super_admin";

      if (!alive) return;

      setAuthorized(allowed);

      if (!allowed) {
        setMessage(error?.message || "Super Admin access required.");
        return;
      }

      try {
        await loadData();
      } catch (err: any) {
        if (alive) setMessage(err.message || "Could not load Question Bank.");
      }
    }

    void init();

    return () => {
      alive = false;
    };
  }, [supabase]);

  const availableChapters = chapters.filter(
    c => !subjectFilter || c.subject_id === subjectFilter
  );

  const filteredQuestions = questions.filter(q => {
    const matchesSubject =
      !subjectFilter || q.subject_id === subjectFilter;

    const matchesChapter =
      !chapterFilter || normalize(q.chapter) === normalize(
        chapters.find(c => c.id === chapterFilter)?.name
      );

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && q.verified) ||
      (statusFilter === "pending" && !q.verified) ||
      (statusFilter === "active" && q.is_active) ||
      (statusFilter === "inactive" && !q.is_active);

    const searchText = normalize(search);

    const matchesSearch =
      !searchText ||
      normalize(q.question_hi).includes(searchText) ||
      normalize(q.question_en).includes(searchText) ||
      normalize(q.question_or).includes(searchText) ||
      normalize(q.chapter).includes(searchText);

    return matchesSubject && matchesChapter && matchesStatus && matchesSearch;
  });

  const pendingCount = questions.filter(q => !q.verified).length;
  const verifiedCount = questions.filter(q => q.verified).length;

  function toggleSelected(id: string) {
    setSelected(old =>
      old.includes(id) ? old.filter(x => x !== id) : [...old, id]
    );
  }

  function selectVisible() {
    const ids = filteredQuestions.map(q => q.id);
    const allSelected = ids.length > 0 && ids.every(id => selected.includes(id));

    setSelected(old =>
      allSelected
        ? old.filter(id => !ids.includes(id))
        : [...new Set([...old, ...ids])]
    );
  }

  async function bulkVerify(value: boolean) {
    if (!supabase || !selected.length) return;

    if (!window.confirm(
      `${selected.length} selected questions ko ${value ? "verify" : "unverify"} karein?`
    )) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("questions")
      .update({ verified: value })
      .in("id", selected);

    if (error) {
      setMessage("Update failed: " + error.message);
    } else {
      setQuestions(old =>
        old.map(q => selected.includes(q.id) ? { ...q, verified: value } : q)
      );
      setMessage(`${selected.length} questions successfully updated.`);
      setSelected([]);
    }

    setBusy(false);
  }

  async function toggleActive(q: Question) {
    if (!supabase) return;

    const { error } = await supabase
      .from("questions")
      .update({ is_active: !q.is_active })
      .eq("id", q.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setQuestions(old =>
      old.map(item =>
        item.id === q.id ? { ...item, is_active: !q.is_active } : item
      )
    );
  }

  function downloadTemplate() {
    const headers = [
      "subject_name", "chapter", "question_hi", "question_or",
      "question_en", "option_a", "option_b", "option_c",
      "option_d", "correct_option", "explanation_hi",
      "explanation_or", "explanation_en", "difficulty", "source_note"
    ];

    const example = [
      "Mathematics", "अनुपात", "25 को 2:3 के अनुपात में बांटने पर पहला भाग कितना होगा?",
      "", "If 25 is divided in the ratio 2:3, what is the first share?",
      "10", "15", "12", "20", "A", "", "", "", "easy", "Sample"
    ];

    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Questions");
    XLSX.writeFile(book, "MISSION_UNIFORM_OP_Question_Template.xlsx");
  }

  async function readExcel(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview([]);
    setMessage("");

    try {
      if (selectedFile.size > 2 * 1024 * 1024) {
        throw new Error("Maximum file size is 2 MB.");
      }

      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!sheet) throw new Error("Worksheet not found.");

      const records = XLSX.utils.sheet_to_json<Record<string, any>>(
        sheet,
        { defval: "", raw: false }
      );

      if (!records.length) throw new Error("No question rows found.");
      if (records.length > 1000) throw new Error("Maximum 1,000 questions per upload.");

      const existingKeys = new Set(
        questions.map(q =>
          `${q.subject_id}|${normalize(q.chapter)}|${normalize(q.question_hi)}`
        )
      );

      const seen = new Set<string>();

      const rows = records.map((raw, index) => {
        const data: any = {};

        Object.entries(raw).forEach(([key, value]) => {
          data[key.trim().toLowerCase().replace(/[\s-]+/g, "_")] = String(value ?? "").trim();
        });

        const subject = subjects.find(s =>
          normalize(s.name_en) === normalize(data.subject_name) ||
          normalize(s.name_hi) === normalize(data.subject_name) ||
          s.id === data.subject_id
        );

        const chapter = chapters.find(c =>
          c.subject_id === subject?.id &&
          normalize(c.name) === normalize(data.chapter)
        );

        const options = [
          data.option_a, data.option_b, data.option_c, data.option_d
        ];

        const correctMap: Record<string, string> = {
          A: "A", B: "B", C: "C", D: "D",
          "1": "A", "2": "B", "3": "C", "4": "D"
        };

        const correct = correctMap[String(data.correct_option).toUpperCase()] || "";
        const errors: string[] = [];

        if (!subject) errors.push("Subject not found.");
        if (!chapter) errors.push("Chapter not found for this subject.");
        if (!data.question_hi) errors.push("Hindi question required.");
        if (options.some((v: string) => !v)) errors.push("All four options required.");
        if (!correct) errors.push("Correct option must be A/B/C/D.");
        
        const key = `${subject?.id}|${normalize(data.chapter)}|${normalize(data.question_hi)}`;

        if (seen.has(key)) errors.push("Duplicate row in this Excel file.");
        if (existingKeys.has(key)) errors.push("Question already exists in database.");

        seen.add(key);

        return {
          row: index + 2,
          subject: subject?.name_en || data.subject_name,
          chapter: data.chapter,
          question: data.question_hi,
          errors,
          payload: errors.length ? null : {
            subject_id: subject!.id,
            chapter: chapter!.name,
            question_hi: data.question_hi,
            question_or: data.question_or || null,
            question_en: data.question_en || null,
            options,
            correct_option: correct,
            explanation_hi: data.explanation_hi || null,
            explanation_or: data.explanation_or || null,
            explanation_en: data.explanation_en || null,
            difficulty: ["easy", "medium", "hard"].includes(normalize(data.difficulty))
              ? normalize(data.difficulty) : "medium",
            source_note: data.source_note || null,
            verified: false,
            is_active: true
          }
        };
      });

      setPreview(rows);
      const valid = rows.filter(r => r.payload).length;
      setMessage(`${rows.length} rows loaded. ${valid} valid, ${rows.length - valid} need correction.`);
    } catch (err: any) {
      setMessage(err.message || "Could not read Excel file.");
    }
  }

  async function importExcel() {
    if (!supabase) return;

    const valid = preview.filter(r => r.payload).map(r => r.payload);
    if (!valid.length) {
      setMessage("No valid questions to import.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("questions").insert(valid);

    if (error) {
      setMessage("Import failed: " + error.message);
    } else {
      setMessage(`${valid.length} questions imported. All are unverified.`);
      setPreview([]);
      setFile(null);
      await loadData();
    }

    setBusy(false);
  }

  if (authorized === null) {
    return <main className="content-wrap"><section className="panel">Checking admin access...</section></main>;
  }

  if (!authorized) {
    return <main className="content-wrap"><section className="panel">
      <h1>Admin access required</h1>
      <p>{message}</p>
      <a href="/login" className="btn primary">Go to Login</a>
    </section></main>;
  }

  return (
    <main className="content-wrap">
      <section className="panel">
        <span className="eyebrow">MISSION UNIFORM OP · ADMIN</span>
        <h1>Question Bank V2</h1>
        <p>Upload up to 1,000 questions per subject. Verify them to automatically activate 30-question random subject mock tests.</p>

        {message && <div className="notice" role="status">{message}</div>}

        <div className="bulk-summary">
          <span>Total loaded: <b>{questions.length}</b></span>
          <span>Verified: <b>{verifiedCount}</b></span>
          <span>Pending: <b>{pendingCount}</b></span>
        </div>

        <h2>Question Filters</h2>
        <div className="bulk-template-actions">
          <label>
            Subject
            <select value={subjectFilter} onChange={e => {
              setSubjectFilter(e.target.value);
              setChapterFilter("");
            }}>
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name_en}</option>
              ))}
            </select>
          </label>

          <label>
            Chapter
            <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}>
              <option value="">All Chapters</option>
              {availableChapters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            Verification
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Questions</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending Verification</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <label>
            Search
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions..."
            />
          </label>
        </div>

        <div className="bulk-template-actions">
          <button className="btn secondary" onClick={selectVisible}>
            Select / Deselect Visible ({filteredQuestions.length})
          </button>
          <button className="btn primary" disabled={busy || !selected.length}
            onClick={() => void bulkVerify(true)}>
            Verify Selected ({selected.length})
          </button>
          <button className="btn secondary" disabled={busy || !selected.length}
            onClick={() => void bulkVerify(false)}>
            Unverify Selected
          </button>
          <button className="btn secondary" onClick={() => setSelected([])}>
            Clear Selection
          </button>
        </div>

        <div className="bulk-table-wrap">
          <table className="bulk-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Question</th>
                <th>Chapter</th>
                <th>Difficulty</th>
                <th>Verification</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map(q => (
                <tr key={q.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(q.id)}
                      onChange={() => toggleSelected(q.id)}
                    />
                  </td>
                  <td>{q.question_hi || q.question_en || q.question_or || "—"}</td>
                  <td>{q.chapter || "—"}</td>
                  <td>{q.difficulty || "—"}</td>
                  <td>{q.verified ? "Verified" : "Pending"}</td>
                  <td>{q.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button className="btn secondary" onClick={() => void toggleActive(q)}>
                      {q.is_active ? "Unpublish" : "Publish"}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredQuestions.length && (
                <tr><td colSpan={7}>No questions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted">Latest 500 questions are loaded. Verification is manual and applies only to selected records.</p>
      </section>

      <section className="panel">
        <h2>Bulk Excel Import</h2>
        <p>Upload Excel/CSV using subject name and exact chapter name. New questions are always imported as unverified.</p>

        <button className="btn secondary" onClick={downloadTemplate}>
          Download Excel Template
        </button>

        <label>
          Choose Excel or CSV
          <input type="file" accept=".xlsx,.xls,.csv" onChange={readExcel} />
        </label>

        {file && <p>Selected: {file.name}</p>}

        {preview.length > 0 && (
          <>
            <p>
              Valid: {preview.filter(r => r.payload).length} |
              Errors: {preview.filter(r => r.errors.length).length}
            </p>

            <div className="bulk-table-wrap">
              <table className="bulk-table">
                <thead>
                  <tr><th>Row</th><th>Subject</th><th>Chapter</th><th>Question</th><th>Validation</th></tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.subject}</td>
                      <td>{r.chapter}</td>
                      <td>{r.question}</td>
                      <td>{r.errors.length ? r.errors.join(" ") : "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn primary"
              disabled={busy || !preview.some(r => r.payload)}
              onClick={() => void importExcel()}>
              {busy ? "Importing..." : "Import Valid Questions"}
            </button>

            <button className="btn secondary" onClick={() => {
              setPreview([]);
              setFile(null);
            }}>
              Clear Preview
            </button>
          </>
        )}
      </section>
    </main>
  );
}
