"use client";

import { filterExamSubjects } from "@/lib/exam-subjects";

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
  question_hi: string | null;
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
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [importSubjectId, setImportSubjectId] = useState("");
  const [importChapterId, setImportChapterId] = useState("");
  const [importDifficulty, setImportDifficulty] = useState("excel");
  const [preview, setPreview] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editDraft, setEditDraft] = useState({ question_hi: "", question_en: "", question_or: "", options: ["", "", "", ""], correct_option: "A", difficulty: "medium", chapter: "" });
  const [bulkDraft, setBulkDraft] = useState({ subject_id: "", chapter: "", difficulty: "", verified: "", is_active: "" });


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
          .limit(5000)
      ]);

    if (subjectResult.error) throw subjectResult.error;
    if (chapterResult.error) throw chapterResult.error;
    if (questionResult.error) throw questionResult.error;

    setSubjects(filterExamSubjects(subjectResult.data || []));
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
        .select("role,permissions,is_blocked")
        .eq("id", auth.user.id)
        .maybeSingle();

      const allowed = !error && !profile?.is_blocked && (profile?.role === "super_admin" || (profile?.role === "staff_admin" && Boolean((profile?.permissions as Record<string, boolean> | null)?.manage_questions)));

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

  const importChapters = chapters.filter(
    c => !importSubjectId || c.subject_id === importSubjectId
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
  const smartAudit = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0, incomplete = 0, invalidKeys = 0;
    for (const q of questions) {
      const key = [q.subject_id || "", normalize(q.chapter), normalize(q.question_hi || q.question_en || q.question_or)].join("|");
      if (key.split("|").pop()) {
        if (seen.has(key)) duplicates++;
        else seen.add(key);
      }
      const opts = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
      const values = opts.map((v:any) => typeof v === "string" ? v.trim() : String(v?.text ?? v?.value ?? "").trim());
      if (![q.question_hi, q.question_en, q.question_or].some(v => v?.trim()) || values.length !== 4 || values.some(v => !v)) incomplete++;
      if (!["A","B","C","D"].includes(String(q.correct_option || "").toUpperCase())) invalidKeys++;
    }
    return { duplicates, incomplete, invalidKeys, scanned: questions.length };
  }, [questions]);


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

  async function verifyOne(q: Question) {
    if (!supabase || q.verified) return;
    setBusy(true);
    const { error } = await supabase.from("questions").update({ verified: true }).eq("id", q.id);
    if (error) {
      setMessage("Verification failed: " + error.message);
    } else {
      setQuestions(old => old.map(item => item.id === q.id ? { ...item, verified: true } : item));
      setMessage("Question verified successfully.");
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


  function beginEdit(q: Question) {
    const opts = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
    setEditingQuestion(q);
    setEditDraft({
      question_hi: q.question_hi || "", question_en: q.question_en || "", question_or: q.question_or || "",
      options: [0,1,2,3].map(i => { const v:any = opts[i]; return typeof v === "string" ? v : String(v?.text ?? v?.value ?? ""); }),
      correct_option: String(q.correct_option || "A").toUpperCase(), difficulty: q.difficulty || "medium", chapter: q.chapter || ""
    });
  }

  async function saveEdit() {
    if (!supabase || !editingQuestion) return;
    if (![editDraft.question_hi, editDraft.question_en, editDraft.question_or].some(v => v.trim()) || editDraft.options.some(v => !v.trim()) || !["A","B","C","D"].includes(editDraft.correct_option)) {
      setMessage("At least one question language (Hindi, English or Odia), all four options and correct answer are required."); return;
    }
    setBusy(true);
    const { error } = await supabase.from("questions").update({
      question_hi: editDraft.question_hi.trim() || null, question_en: editDraft.question_en.trim() || null,
      question_or: editDraft.question_or.trim() || null, options: editDraft.options,
      correct_option: editDraft.correct_option, difficulty: editDraft.difficulty, chapter: editDraft.chapter.trim() || null
    }).eq("id", editingQuestion.id);
    if (error) setMessage("Save failed: " + error.message);
    else {
      setQuestions(old => old.map(q => q.id === editingQuestion.id ? { ...q, question_hi: editDraft.question_hi.trim() || null, question_en: editDraft.question_en.trim() || null, question_or: editDraft.question_or.trim() || null, options: editDraft.options, correct_option: editDraft.correct_option, difficulty: editDraft.difficulty, chapter: editDraft.chapter.trim() || null } : q));
      setEditingQuestion(null); setMessage("Question updated.");
    }
    setBusy(false);
  }

  async function bulkDelete() {
    if (!supabase || !selected.length) return;
    if (!window.confirm("Permanently delete " + selected.length + " selected questions? This cannot be undone.")) return;
    setBusy(true);
    const ids = [...selected];
    const { error } = await supabase.from("questions").delete().in("id", ids);
    if (error) setMessage("Delete failed: " + error.message);
    else { setQuestions(old => old.filter(q => !ids.includes(q.id))); setSelected([]); setMessage(ids.length + " questions deleted."); }
    setBusy(false);
  }

  async function bulkUpdate() {
    if (!supabase || !selected.length) return;
    const patch:any = {};
    if (bulkDraft.subject_id) patch.subject_id = bulkDraft.subject_id;
    if (bulkDraft.chapter.trim()) patch.chapter = bulkDraft.chapter.trim();
    if (bulkDraft.difficulty) patch.difficulty = bulkDraft.difficulty;
    if (bulkDraft.verified !== "") patch.verified = bulkDraft.verified === "true";
    if (bulkDraft.is_active !== "") patch.is_active = bulkDraft.is_active === "true";
    if (!Object.keys(patch).length) { setMessage("Choose at least one bulk update field."); return; }
    if (!window.confirm("Apply these changes to " + selected.length + " selected questions?")) return;
    setBusy(true);
    const ids = [...selected];
    const { error } = await supabase.from("questions").update(patch).in("id", ids);
    if (error) setMessage("Bulk update failed: " + error.message);
    else {
      setQuestions(old => old.map(q => ids.includes(q.id) ? { ...q, ...patch } : q));
      setSelected([]); setBulkDraft({ subject_id:"", chapter:"", difficulty:"", verified:"", is_active:"" });
      setMessage(ids.length + " questions updated.");
    }
    setBusy(false);
  }

  async function bulkSetActive(value:boolean) {
    if (!supabase || !selected.length) return;
    if (!window.confirm((value ? "Publish " : "Unpublish ") + selected.length + " selected questions?")) return;
    setBusy(true); const ids=[...selected];
    const {error}=await supabase.from("questions").update({is_active:value}).in("id",ids);
    if(error) setMessage(error.message);
    else { setQuestions(old=>old.map(q=>ids.includes(q.id)?{...q,is_active:value}:q)); setSelected([]); setMessage(ids.length+" questions updated."); }
    setBusy(false);
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
      if (selectedFile.size > 10 * 1024 * 1024) {
        throw new Error("Maximum file size is 10 MB.");
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

      // Compare every populated language independently. This prevents
      // English/Odia-only rows from colliding on an empty Hindi value.
      const makeQuestionKeys = (subjectId: string, chapterName: string, values: unknown[]) =>
        values
          .map(normalize)
          .filter(Boolean)
          .map(questionText => `${subjectId}|${normalize(chapterName)}|${questionText}`);

      const existingKeys = new Set(
        questions.flatMap(q =>
          makeQuestionKeys(q.subject_id || "", q.chapter || "", [
            q.question_hi, q.question_en, q.question_or
          ])
        )
      );

      const seen = new Set<string>();

      const rows = records.map((raw, index) => {
        const data: any = {};

        Object.entries(raw).forEach(([key, value]) => {
          data[key.trim().toLowerCase().replace(/[\s-]+/g, "_")] = String(value ?? "").trim();
        });

        const subject = importSubjectId
          ? subjects.find(s => s.id === importSubjectId)
          : subjects.find(s =>
              normalize(s.name_en) === normalize(data.subject_name) ||
              normalize(s.name_hi) === normalize(data.subject_name) ||
              s.id === data.subject_id
            );

        const chapter = importChapterId
          ? chapters.find(c => c.id === importChapterId && c.subject_id === subject?.id)
          : chapters.find(c =>
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
        if (![data.question_hi, data.question_en, data.question_or].some((v: string) => v?.trim())) errors.push("At least one question language (Hindi, English or Odia) is required.");
        if (options.some((v: string) => !v)) errors.push("All four options required.");
        if (!correct) errors.push("Correct option must be A/B/C/D.");
        
        const rowKeys = makeQuestionKeys(subject?.id || "", data.chapter, [
          data.question_hi, data.question_en, data.question_or
        ]);

        if (rowKeys.some(key => seen.has(key))) errors.push("Duplicate row in this Excel file.");
        if (rowKeys.some(key => existingKeys.has(key))) errors.push("Question already exists in database.");

        rowKeys.forEach(key => seen.add(key));

        return {
          row: index + 2,
          subject: subject?.name_en || data.subject_name,
          chapter: importChapterId ? (chapter?.name || data.chapter) : data.chapter,
          question: data.question_hi || data.question_en || data.question_or,
          errors,
          payload: errors.length ? null : {
            subject_id: subject!.id,
            chapter: chapter!.name,
            question_hi: data.question_hi || null,
            question_or: data.question_or || null,
            question_en: data.question_en || null,
            options,
            correct_option: correct,
            explanation_hi: data.explanation_hi || null,
            explanation_or: data.explanation_or || null,
            explanation_en: data.explanation_en || null,
            difficulty: importDifficulty !== "excel"
              ? importDifficulty
              : (["easy", "medium", "hard"].includes(normalize(data.difficulty)) ? normalize(data.difficulty) : "medium"),
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

    let importError: any = null;
    for (let i = 0; i < valid.length; i += 250) {
      const { error } = await supabase.from("questions").insert(valid.slice(i, i + 250));
      if (error) { importError = error; break; }
      setMessage(`Imported ${Math.min(i + 250, valid.length)} / ${valid.length} questions...`);
    }

    if (importError) {
      setMessage("Import failed: " + importError.message + ". Already inserted rows remain saved; remove duplicates before retrying.");
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
    <main className="admin-qb">
      <section className="admin-qb-hero">
        <div>
          <span className="admin-qb-kicker">MISSION UNIFORM OP · CONTENT CONTROL</span>
          <h1>Question Bank</h1>
          <p>Har subject ka question bank alag manage karein. Pending questions review karein aur verified questions ko mock tests ke liye ready rakhein.</p>
          <div className="admin-qb-hero-actions">
            <button className="admin-qb-gold-btn" onClick={downloadTemplate}>↓ Download Excel Template</button>
            <a className="admin-qb-ghost-btn" href="#qb-import">＋ Bulk Import</a>
          </div>
        </div>
        <div className="admin-qb-crest"><span>✦</span><b>MU</b><small>QUESTION BANK</small></div>
      </section>

      {message && <div className="admin-qb-notice" role="status">{message}</div>}

      <section className="admin-qb-overview">
        <div className="admin-qb-metric"><span>▤</span><small>Loaded Questions</small><b>{questions.length}</b></div>
        <div className="admin-qb-metric is-verified"><span>✓</span><small>Verified</small><b>{verifiedCount}</b></div>
        <div className="admin-qb-metric is-pending"><span>◷</span><small>Unverified</small><b>{pendingCount}</b></div>
        <div className="admin-qb-metric"><span>▣</span><small>Subjects</small><b>{subjects.length}</b></div>
      </section>

      <section style={{margin:"16px 0",padding:18,border:"1px solid #d9e2ea",borderRadius:14,background:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <div><span style={{fontSize:11,fontWeight:800,letterSpacing:1,color:"#9a742b"}}>FREE · LOCAL CHECK · NO API KEY</span><h2 style={{margin:"5px 0",color:"#173b50"}}>Smart Question Audit</h2><p style={{margin:0,fontSize:13,color:"#64748b"}}>Automatic quality checks. Ye AI-generated verification nahi hai; final answer admin hi verify kare.</p></div>
          <b style={{color:"#173b50"}}>{smartAudit.scanned} scanned</b>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:14}}>
          <div style={{padding:12,background:"#fff7ed",borderRadius:9}}><small>Possible duplicates</small><h2 style={{margin:"4px 0"}}>{smartAudit.duplicates}</h2></div>
          <div style={{padding:12,background:"#fff7ed",borderRadius:9}}><small>Incomplete questions</small><h2 style={{margin:"4px 0"}}>{smartAudit.incomplete}</h2></div>
          <div style={{padding:12,background:"#fff7ed",borderRadius:9}}><small>Invalid answer keys</small><h2 style={{margin:"4px 0"}}>{smartAudit.invalidKeys}</h2></div>
        </div>
        <p style={{margin:"10px 0 0",fontSize:12,color:"#64748b"}}>Audit page par loaded latest 5,000 records ko scan karta hai. Ye automatically delete ya verify nahi karta.</p>
      </section>

      <section className="admin-qb-section">
        <div className="admin-qb-section-head">
          <div><span className="admin-qb-kicker-dark">01 · SUBJECT LIBRARY</span><h2>Choose a Subject Bank</h2><p>Subject select karte hi usi subject ke questions aur chapters dikhaye jayenge.</p></div>
          <button className="admin-qb-reset" onClick={() => { setSubjectFilter(""); setChapterFilter(""); setSearch(""); setSelected([]); }}>Reset Filters</button>
        </div>
        <div className="admin-qb-subject-grid">
          <button type="button" className={`admin-qb-subject-card ${!subjectFilter ? "active" : ""}`} onClick={() => { setSubjectFilter(""); setChapterFilter(""); setSelected([]); }}>
            <span className="admin-qb-subject-icon">▦</span><b>All Subjects</b><small>Combined question library</small><strong>{questions.length} loaded</strong>
          </button>
          {subjects.map((s, index) => {
            const bank = questions.filter(q => q.subject_id === s.id);
            const isActive = bank.filter(q => q.is_active).length;
            return <button type="button" key={s.id} className={`admin-qb-subject-card ${subjectFilter === s.id ? "active" : ""}`} onClick={() => { setSubjectFilter(s.id); setChapterFilter(""); setSelected([]); }}>
              <span className="admin-qb-subject-icon">{["◈","▤","✥","⌘","◎","◇"][index % 6]}</span>
              <b>{s.name_en}</b>
              {s.name_hi && <small>{s.name_hi}</small>}
              <strong>{bank.length} questions · {isActive} active</strong>
            </button>;
          })}
        </div>
      </section>

      <section className="admin-qb-section admin-qb-library">
        <div className="admin-qb-section-head">
          <div><span className="admin-qb-kicker-dark">02 · QUESTION REVIEW</span><h2>{subjects.find(s => s.id === subjectFilter)?.name_en || "All Subjects"} Bank</h2><p>Verified aur unverified questions alag-alag tabs mein manage karein.</p></div>
        </div>
        <div className="admin-qb-tabs">
          <button className={statusFilter === "pending" ? "active pending" : ""} onClick={() => { setStatusFilter("pending"); setSelected([]); }}>
            <span>◷</span><b>Unverified Questions</b><em>{subjectFilter ? questions.filter(q => q.subject_id === subjectFilter && !q.verified).length : pendingCount}</em>
          </button>
          <button className={statusFilter === "verified" ? "active verified" : ""} onClick={() => { setStatusFilter("verified"); setSelected([]); }}>
            <span>✓</span><b>Verified Questions</b><em>{subjectFilter ? questions.filter(q => q.subject_id === subjectFilter && q.verified).length : verifiedCount}</em>
          </button>
        </div>

        <div className="admin-qb-filters">
          <label>Chapter<select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}><option value="">All Chapters</option>{availableChapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Hindi, Odia or English question..." /></label>
          <label>Question status<select value={statusFilter === "verified" ? "verified" : statusFilter === "pending" ? "pending" : "all"} onChange={e => { setStatusFilter(e.target.value); setSelected([]); }}><option value="pending">Unverified only</option><option value="verified">Verified only</option><option value="all">All statuses</option></select></label>
        </div>

        <div className="admin-qb-toolbar">
          <span><b>{filteredQuestions.length}</b> questions shown · {selected.length} selected</span>
          <div>
            <button className="admin-qb-light-btn" onClick={selectVisible}>Select Visible</button>
            {statusFilter !== "verified" && <button className="admin-qb-verify-btn" disabled={busy || !selected.length} onClick={() => void bulkVerify(true)}>✓ Verify Selected</button>}
            {statusFilter !== "pending" && <button className="admin-qb-light-btn" disabled={busy || !selected.length} onClick={() => void bulkVerify(false)}>Move to Unverified</button>}
            <button className="admin-qb-light-btn" disabled={busy || !selected.length} onClick={() => void bulkSetActive(true)}>Publish Selected</button>
            <button className="admin-qb-light-btn" disabled={busy || !selected.length} onClick={() => void bulkSetActive(false)}>Unpublish Selected</button>
            <button className="admin-qb-danger-btn" disabled={busy || !selected.length} onClick={() => void bulkDelete()}>Delete Selected</button>
            <button className="admin-qb-reset" onClick={() => setSelected([])}>Clear</button>
          </div>
        </div>

        {selected.length > 0 && <div className="admin-qb-bulk-editor">
          <b>Bulk update · {selected.length} selected</b>
          <div className="admin-qb-bulk-grid">
            <label>Move to subject<select value={bulkDraft.subject_id} onChange={e=>setBulkDraft(v=>({...v,subject_id:e.target.value}))}><option value="">No change</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name_en}</option>)}</select></label>
            <label>Set chapter<input value={bulkDraft.chapter} onChange={e=>setBulkDraft(v=>({...v,chapter:e.target.value}))} placeholder="Leave blank for no change"/></label>
            <label>Difficulty<select value={bulkDraft.difficulty} onChange={e=>setBulkDraft(v=>({...v,difficulty:e.target.value}))}><option value="">No change</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
            <label>Verification<select value={bulkDraft.verified} onChange={e=>setBulkDraft(v=>({...v,verified:e.target.value}))}><option value="">No change</option><option value="true">Verified</option><option value="false">Unverified</option></select></label>
            <label>Visibility<select value={bulkDraft.is_active} onChange={e=>setBulkDraft(v=>({...v,is_active:e.target.value}))}><option value="">No change</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
            <button className="admin-qb-verify-btn" disabled={busy} onClick={()=>void bulkUpdate()}>Apply Bulk Update</button>
          </div>
        </div>}

        <div className="admin-qb-question-list">
          {filteredQuestions.map((q, index) => (
            <article className="admin-qb-question" key={q.id}>
              <label className="admin-qb-check"><input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleSelected(q.id)} /><span /></label>
              <div className="admin-qb-question-body">
                <div className="admin-qb-question-meta"><span>{subjects.find(s => s.id === q.subject_id)?.name_en || "Subject not set"}</span><span>{q.chapter || "No chapter"}</span><span className={q.difficulty === "easy" ? "easy" : q.difficulty === "hard" ? "hard" : ""}>{q.difficulty || "medium"}</span></div>
                <button
                  type="button"
                  className="admin-qb-question-toggle"
                  aria-expanded={expandedQuestion === q.id}
                  onClick={() => setExpandedQuestion(current => current === q.id ? null : q.id)}
                >
                  <span className="admin-qb-question-title">{q.question_hi || q.question_en || q.question_or || "Question text unavailable"}</span>
                  <span className="admin-qb-expand-indicator">{expandedQuestion === q.id ? "− Hide details" : "+ View options"}</span>
                </button>
                {q.question_en && q.question_hi && <p className="admin-qb-translation">{q.question_en}</p>}
                {expandedQuestion === q.id && (
                  <div className="admin-qb-answer-panel">
                    <div className="admin-qb-answer-heading">ANSWER OPTIONS</div>
                    <div className="admin-qb-options-grid">
                      {(Array.isArray(q.options) ? q.options : Object.values(q.options || {})).map((option: any, optionIndex: number) => {
                        const optionLabel = ["A", "B", "C", "D"][optionIndex] || String(optionIndex + 1);
                        const optionText = typeof option === "string" ? option : String(option?.text ?? option?.value ?? "");
                        const isCorrect = String(q.correct_option).toUpperCase() === optionLabel || String(q.correct_option) === String(optionIndex + 1);
                        return <div className={`admin-qb-option ${isCorrect ? "is-correct" : ""}`} key={optionIndex}>
                          <b>{optionLabel}</b><span>{optionText}</span>{isCorrect && <em>Correct answer</em>}
                        </div>;
                      })}
                    </div>
                    <div className="admin-qb-answer-key">Correct option: <strong>{q.correct_option}</strong></div>
                  </div>
                )}
                <div className="admin-qb-question-foot"><span className={q.verified ? "status-good" : "status-wait"}>{q.verified ? "✓ Verified" : "◷ Awaiting verification"}</span><span className={q.is_active ? "status-good" : "status-muted"}>{q.is_active ? "● Active" : "○ Inactive"}</span><small>#{index + 1}</small></div>
              </div>
              <div className="admin-qb-question-actions">
                {!q.verified && <button className="admin-qb-verify-mini" disabled={busy} onClick={() => void verifyOne(q)}>Verify</button>}
                <button className="admin-qb-light-btn" disabled={busy} onClick={() => beginEdit(q)}>Edit</button><button className="admin-qb-light-btn" disabled={busy} onClick={() => void toggleActive(q)}>{q.is_active ? "Unpublish" : "Publish"}</button>
              </div>
            </article>
          ))}
          {!filteredQuestions.length && <div className="admin-qb-empty"><span>⌕</span><b>No questions in this section</b><p>Is subject/status ke liye questions nahi mile. Excel import karein ya filters reset karein.</p></div>}
        </div>
        <p className="admin-qb-footnote">Latest 5,000 records are loaded for this screen. Verification status is controlled by the admin; only active, verified questions are eligible for student mock tests.</p>
      </section>

      {editingQuestion && <div className="admin-qb-modal-backdrop" role="presentation">
        <section className="admin-qb-edit-modal" role="dialog" aria-modal="true" aria-label="Edit question">
          <div className="admin-qb-edit-head"><h2>Edit Question</h2><button onClick={()=>setEditingQuestion(null)} aria-label="Close">×</button></div>
          <label>Question (Hindi)<textarea value={editDraft.question_hi} onChange={e=>setEditDraft(v=>({...v,question_hi:e.target.value}))}/></label>
          <label>Question (English)<textarea value={editDraft.question_en} onChange={e=>setEditDraft(v=>({...v,question_en:e.target.value}))}/></label>
          <label>Question (Odia)<textarea value={editDraft.question_or} onChange={e=>setEditDraft(v=>({...v,question_or:e.target.value}))}/></label>
          <div className="admin-qb-bulk-grid">{editDraft.options.map((value,i)=><label key={i}>Option {["A","B","C","D"][i]}<input value={value} onChange={e=>setEditDraft(v=>({...v,options:v.options.map((x,j)=>j===i?e.target.value:x)}))}/></label>)}</div>
          <div className="admin-qb-bulk-grid"><label>Correct answer<select value={editDraft.correct_option} onChange={e=>setEditDraft(v=>({...v,correct_option:e.target.value}))}>{["A","B","C","D"].map(x=><option key={x}>{x}</option>)}</select></label><label>Chapter<input value={editDraft.chapter} onChange={e=>setEditDraft(v=>({...v,chapter:e.target.value}))}/></label><label>Difficulty<select value={editDraft.difficulty} onChange={e=>setEditDraft(v=>({...v,difficulty:e.target.value}))}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div>
          <div className="admin-qb-import-actions"><button className="admin-qb-verify-btn" disabled={busy} onClick={()=>void saveEdit()}>{busy?"Saving...":"Save Changes"}</button><button className="admin-qb-light-btn" onClick={()=>setEditingQuestion(null)}>Cancel</button></div>
        </section>
      </div>}

      <section className="admin-qb-section admin-qb-import" id="qb-import">
        <div className="admin-qb-section-head"><div><span className="admin-qb-kicker-dark">03 · BULK QUESTION UPLOAD</span><h2>Import Questions in Bulk</h2><p>Excel/CSV upload karein. Hindi, English, Odia — teeno ya inmein se koi ek language bhi chalegi. Har naya question automatically Unverified mein aayega.</p></div><span className="admin-qb-import-badge">XLSX · XLS · CSV</span></div>
        <div className="admin-qb-import-controls">
          <div className="admin-qb-import-selects">
            <label>Default Subject
              <select value={importSubjectId} onChange={e => { setImportSubjectId(e.target.value); setImportChapterId(""); }}>
                <option value="">Use subject_name from Excel</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name_en}{s.name_hi ? ` · ${s.name_hi}` : ""}</option>)}
              </select>
              <small>Choose once to assign every row to this subject.</small>
            </label>
            <label>Default Chapter
              <select value={importChapterId} onChange={e => setImportChapterId(e.target.value)} disabled={!importSubjectId}>
                <option value="">Use chapter from Excel</option>
                {importChapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <small>{importSubjectId ? "Optional: apply one chapter to all imported rows." : "Select a subject first to choose a chapter."}</small>
            </label>
            <label>Default Difficulty
              <select value={importDifficulty} onChange={e => setImportDifficulty(e.target.value)}>
                <option value="excel">Use Excel value</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <small>Optional: override difficulty for all rows.</small>
            </label>
          </div>
          <div className="admin-qb-upload-row">
            <label className="admin-qb-file"><span>＋</span><b>Choose Excel or CSV file</b><small>Maximum 10 MB · Up to 1,000 questions</small><input type="file" accept=".xlsx,.xls,.csv" onChange={readExcel} /></label>
            <div className="admin-qb-upload-info"><b>Language support</b><p>Question Hindi, English aur Odia tino mein de sakte hain, ya sirf ek language mein bhi. Har row mein kam se kam ek question language zaroor bharein. Options A–D aur correct answer required hain.</p><p>Subject, Chapter aur Difficulty upar select kar sakte hain. Jo option blank rahega, uski value Excel se li jayegi.</p><button className="admin-qb-light-btn" onClick={downloadTemplate}>↓ Download Template</button></div>
          </div>
        </div>
        {file && <div className="admin-qb-file-selected">Selected file: <b>{file.name}</b></div>}
        {preview.length > 0 && <>
          <div className="admin-qb-preview-summary"><b>{preview.filter(r => r.payload).length} valid</b><span>{preview.filter(r => r.errors.length).length} need correction</span><span>{preview.length} total rows</span></div>
          <div className="admin-qb-preview-table"><table><thead><tr><th>Row</th><th>Subject</th><th>Chapter</th><th>Question</th><th>Validation</th></tr></thead><tbody>{preview.map(r => <tr key={r.row}><td>{r.row}</td><td>{r.subject}</td><td>{r.chapter}</td><td>{r.question}</td><td>{r.errors.length ? r.errors.join(" ") : "✓ Ready"}</td></tr>)}</tbody></table></div>
          <div className="admin-qb-import-actions"><button className="admin-qb-verify-btn" disabled={busy || !preview.some(r => r.payload)} onClick={() => void importExcel()}>{busy ? "Importing..." : "Import Valid Questions"}</button><button className="admin-qb-light-btn" onClick={() => { setPreview([]); setFile(null); }}>Clear Preview</button></div>
        </>}
      </section>
    </main>
  );
}
