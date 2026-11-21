"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Pool = { id: string; title: string; total_questions: number; is_active: boolean };
type Subject = { id: string; name_en: string | null; name_hi: string | null };

export default function QuestionPoolManager() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [pools, setPools] = useState<Pool[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [testTitle, setTestTitle] = useState("");
  const [poolId, setPoolId] = useState("");
  const [duration, setDuration] = useState(30);
  const [count, setCount] = useState(10);
  const [negative, setNegative] = useState(0);

  async function load() {
    if (!sb) return;
    const [p, s] = await Promise.all([
      sb.from("question_pools").select("id,title,total_questions,is_active").order("created_at", { ascending: false }),
      sb.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en")
    ]);
    if (p.error) setMessage(p.error.message);
    else setPools(p.data || []);
    if (s.data) setSubjects(s.data);
  }

  useEffect(() => { void load(); }, []);

  async function readFile(selected: File | null) {
    setFile(selected);
    setRows([]);
    if (!selected) return;
    try {
      if (selected.size > 5 * 1024 * 1024) throw new Error("File size maximum 5 MB hai.");
      const wb = XLSX.read(await selected.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!data.length) throw new Error("Excel/CSV mein question rows nahi mile.");
      const normalized = data.map((r, i) => {
        const x: any = {};
        Object.entries(r).forEach(([k, v]) => x[k.trim().toLowerCase().replace(/[\s-]+/g, "_")] = String(v ?? "").trim());
        const options = [x.option_a, x.option_b, x.option_c, x.option_d];
        const answer = String(x.correct_option || "").toUpperCase();
        if (!x.question_hi || options.some(v => !v) || !["A","B","C","D"].includes(answer)) {
          throw new Error("Row " + (i + 2) + ": question_hi, option_a-d aur correct_option (A/B/C/D) zaroori hain.");
        }
        return {
          question_hi: x.question_hi, question_or: x.question_or || null, question_en: x.question_en || null,
          options, correct_option: answer, explanation_hi: x.explanation_hi || null,
          chapter: x.chapter || null, difficulty: x.difficulty || "medium"
        };
      });
      if (normalized.length > 2000) throw new Error("Ek upload mein maximum 2000 questions allowed hain.");
      setRows(normalized);
      setMessage(normalized.length + " questions ready to import.");
    } catch (e: any) { setMessage(e.message || "File read nahi hui."); }
  }

  async function createPool() {
    if (!sb || !title.trim() || !rows.length) { setMessage("Pool title aur valid Excel/CSV file zaroori hai."); return; }
    setBusy(true); setMessage("");
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please login as Super Admin.");
      const { data: pool, error: poolError } = await sb.from("question_pools")
        .insert({ title: title.trim(), description: description || null, subject_id: subjectId || null, created_by: user.id })
        .select("id").single();
      if (poolError) throw poolError;
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((q: any) => ({ ...q, pool_id: pool.id }));
        const { error } = await sb.from("pool_questions").insert(batch);
        if (error) {
          await sb.from("question_pools").delete().eq("id", pool.id);
          throw error;
        }
      }
      setMessage("Pool created successfully. " + rows.length + " questions imported.");
      setTitle(""); setDescription(""); setRows([]); setFile(null);
      await load();
    } catch (e: any) { setMessage(e.message || "Pool create nahi hua."); }
    finally { setBusy(false); }
  }

  async function createPoolTest() {
    if (!sb || !poolId || !testTitle.trim()) { setMessage("Pool aur test title select karein."); return; }
    const pool = pools.find(p => p.id === poolId);
    if (!pool || count < 1 || count > pool.total_questions) { setMessage("Question count pool size se zyada nahi ho sakta."); return; }
    setBusy(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setMessage("Please login again."); setBusy(false); return; }
    const { error } = await sb.from("test_papers").insert({
      title: testTitle.trim(), description: "Student-wise randomized question pool",
      test_type: "full", question_mode: "pool", pool_id: poolId,
      duration_minutes: duration, total_questions: count, marks_per_question: 1,
      negative_marking: negative, status: "published", created_by: user.id
    });
    setMessage(error?.message || "Pool Mock Test published successfully.");
    if (!error) { setTestTitle(""); await load(); }
    setBusy(false);
  }

  if (!sb) return <section className="panel">Supabase configuration missing.</section>;
  return <div className="admin-tests-page">
    <section className="panel">
      <span className="eyebrow">MISSION UNIFORM OP · QUESTION BANK</span>
      <h1>Question Pool Manager</h1>
      <p>Excel/CSV se reusable question pool banayein. Har student ko apne previous attempts ke hisab se naye questions milenge.</p>
      <label>Pool name<input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Odisha Police GK Master Pool" /></label>
      <label>Description<input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details" /></label>
      <label>Subject<select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">All subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name_en || s.name_hi}</option>)}</select></label>
      <label>Upload Excel / CSV<input className="input" type="file" accept=".xlsx,.xls,.csv" onChange={e => void readFile(e.target.files?.[0] || null)} /></label>
      <p>Required columns: question_hi, option_a, option_b, option_c, option_d, correct_option. Optional: question_or, question_en, explanation_hi, chapter, difficulty.</p>
      <p><b>{rows.length}</b> questions ready {file ? " · " + file.name : ""}</p>
      <button className="btn primary" disabled={busy || !rows.length} onClick={() => void createPool()}>{busy ? "Please wait..." : "Create Question Pool"}</button>
    </section>

    <section className="panel">
      <h2>Create Pool-based Mock Test</h2>
      <label>Test title<input className="input" value={testTitle} onChange={e => setTestTitle(e.target.value)} placeholder="Odisha Police Random Mock 01" /></label>
      <label>Select pool<select className="input" value={poolId} onChange={e => setPoolId(e.target.value)}><option value="">Choose pool</option>{pools.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.title} ({p.total_questions} questions)</option>)}</select></label>
      <div className="form-grid">
        <label>Question count<input className="input" type="number" min="1" max="300" value={count} onChange={e => setCount(Number(e.target.value))} /></label>
        <label>Duration (minutes)<input className="input" type="number" min="1" max="300" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
        <label>Negative marking<input className="input" type="number" min="0" step=".25" value={negative} onChange={e => setNegative(Number(e.target.value))} /></label>
      </div>
      <button className="btn primary" disabled={busy} onClick={() => void createPoolTest()}>{busy ? "Saving..." : "Publish Pool Mock Test"}</button>
    </section>

    <section className="panel">
      <h2>Existing Question Pools</h2>
      {pools.length ? pools.map(p => <article className="review-item" key={p.id}><b>{p.title}</b><p>{p.total_questions} questions · {p.is_active ? "Active" : "Inactive"}</p></article>) : <p>No pools created yet.</p>}
      {message && <p className="bulk-message" role="status">{message}</p>}
    </section>
  </div>;
}
