"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Job = {
  id: string;
  title: string;
  organization: string | null;
  description: string | null;
  official_url: string | null;
  last_date: string | null;
  published: boolean;
  created_at?: string;
};

const blank = { title: "", organization: "", description: "", official_url: "", last_date: "", published: false };

export default function AdminJobAlerts() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<Job[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "published" | "draft">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!sb) { setMessage("Supabase configuration missing."); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await sb.from("job_alerts").select("id,title,organization,description,official_url,last_date,published,created_at").order("created_at", { ascending: false }).limit(300);
    if (error) setMessage(error.message);
    else setRows((data || []) as Job[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [sb]);

  function startNew() {
    setEditing(null);
    setForm(blank);
    setMessage("");
  }

  function edit(job: Job) {
    setEditing(job.id);
    setForm({
      title: job.title || "",
      organization: job.organization || "",
      description: job.description || "",
      official_url: job.official_url || "",
      last_date: job.last_date || "",
      published: !!job.published
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!sb || busy) return;
    if (form.official_url && !/^https?:\/\//i.test(form.official_url)) {
      setMessage("Official link must start with https:// or http://");
      return;
    }
    setBusy(true); setMessage("");
    const payload = {
      title: form.title.trim(),
      organization: form.organization.trim() || null,
      description: form.description.trim() || null,
      official_url: form.official_url.trim() || null,
      last_date: form.last_date || null,
      published: form.published
    };
    const result = editing
      ? await sb.from("job_alerts").update(payload).eq("id", editing)
      : await sb.from("job_alerts").insert(payload);
    if (result.error) setMessage(result.error.message);
    else {
      setMessage(editing ? "Job alert updated successfully." : "Job alert created successfully.");
      setForm(blank); setEditing(null); await load();
    }
    setBusy(false);
  }

  async function setPublished(job: Job, published: boolean) {
    if (!sb) return;
    setBusy(true); setMessage("");
    const { error } = await sb.from("job_alerts").update({ published }).eq("id", job.id);
    if (error) setMessage(error.message);
    else { setMessage(published ? "Job alert published." : "Job alert moved to draft."); await load(); }
    setBusy(false);
  }

  async function remove(job: Job) {
    if (!sb || !window.confirm("Permanently delete this job alert?")) return;
    setBusy(true); setMessage("");
    const { error } = await sb.from("job_alerts").delete().eq("id", job.id);
    if (error) setMessage(error.message);
    else { setMessage("Job alert deleted."); await load(); }
    setBusy(false);
  }

  const filtered = rows.filter(job => {
    const statusMatch = view === "all" || (view === "published" ? job.published : !job.published);
    const text = [job.title, job.organization, job.description].join(" ").toLowerCase();
    return statusMatch && text.includes(search.trim().toLowerCase());
  });

  return <div className="admin-job-alerts">
    <div className="admin-page-heading"><div><span className="admin-kicker">RECRUITMENT CONTENT CONTROL</span><h1>Job Alerts</h1><p>Create, edit, publish and remove recruitment notices shown in the student portal.</p></div><button className="admin-primary compact" onClick={startNew}>＋ New Job Alert</button></div>
    {message && <div className="admin-inline-message" role="status">{message}</div>}
    <section className="admin-panel">
      <div className="admin-panel-title"><div><h2>{editing ? "Edit Job Alert" : "Create Job Alert"}</h2><small>Only published alerts appear on the student side.</small></div>{(editing || form.title || form.organization || form.description || form.official_url || form.last_date || form.published) && <button className="admin-ghost" onClick={startNew}>Clear form ×</button>}</div>
      <form className="admin-form-grid" onSubmit={save}>
        <label>Vacancy / post title *<input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Odisha Police Constable Recruitment"/></label>
        <label>Department / organization<input value={form.organization} onChange={e => setForm({...form,organization:e.target.value})} placeholder="Odisha Police"/></label>
        <label>Last date to apply<input type="date" value={form.last_date} onChange={e => setForm({...form,last_date:e.target.value})}/></label>
        <label>Official notification / apply URL<input type="url" value={form.official_url} onChange={e => setForm({...form,official_url:e.target.value})} placeholder="https://official-website.gov.in/"/></label>
        <label className="wide">Details, eligibility and instructions<textarea rows={5} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Add vacancy details, eligibility, important dates and application instructions…"/></label>
        <label className="wide admin-job-publish"><input type="checkbox" checked={form.published} onChange={e => setForm({...form,published:e.target.checked})}/> Publish immediately (visible to students)</label>
        <div className="wide admin-form-actions"><button className="admin-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Create Job Alert"}</button><button type="button" className="admin-ghost" onClick={startNew}>Reset</button></div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-title"><div><h2>Manage Job Alerts</h2><small>{rows.length} total records</small></div><button className="admin-ghost" onClick={() => void load()} disabled={loading}>↻ Refresh</button></div>
      <div className="admin-job-toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or department…"/><div>{(["all","published","draft"] as const).map(x=><button key={x} className={view===x?"active":""} onClick={()=>setView(x)}>{x==="all"?"All":x==="published"?"Published":"Drafts"}</button>)}</div></div>
      {loading ? <p className="admin-muted">Loading job alerts…</p> : filtered.length === 0 ? <p className="admin-muted">No matching job alerts. Create one above.</p> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vacancy</th><th>Organization</th><th>Last date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(job=><tr key={job.id}><td><b>{job.title}</b><small>{job.description?.slice(0,90) || "No description"}</small></td><td>{job.organization || "—"}</td><td>{job.last_date || "Not set"}</td><td>{job.published ? "Published" : "Draft"}</td><td className="admin-actions"><button onClick={()=>edit(job)}>Edit</button><button onClick={()=>void setPublished(job,!job.published)} disabled={busy}>{job.published?"Unpublish":"Publish"}</button><button className="danger" onClick={()=>void remove(job)} disabled={busy}>Delete</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
