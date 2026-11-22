"use client";

import { useEffect, useMemo, useState } from "react";

type JobAlert = {
  id: string;
  title: string;
  organization: string | null;
  description: string | null;
  official_url: string | null;
  last_date: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date not announced";
  const date = new Date(value + (value.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(value: string | null) {
  if (!value) return false;
  const end = new Date(value + (value.length === 10 ? "T23:59:59" : ""));
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

export default function Jobs() {
  const [jobs, setJobs] = useState<JobAlert[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/job-alerts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Job alerts could not be loaded.");
      setJobs(data.jobs || []);
    } catch (e: any) {
      setError(e.message || "Unable to load job alerts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => jobs.filter(job => {
    const expired = isExpired(job.last_date);
    const matchesStatus = filter === "all" || (filter === "open" ? !expired : expired);
    const haystack = [job.title, job.organization, job.description].join(" ").toLowerCase();
    return matchesStatus && haystack.includes(search.trim().toLowerCase());
  }), [jobs, search, filter]);

  const activeCount = jobs.filter(job => !isExpired(job.last_date)).length;

  return <main className="content-wrap mu-jobs-page">
    <header className="mu-jobs-hero">
      <span className="mu-jobs-kicker">MISSION UNIFORM OP · RECRUITMENT DESK</span>
      <h1>Government Job Alerts</h1>
      <p>Latest recruitment notices, important deadlines and official application links in one place.</p>
      <div className="mu-jobs-stats"><span><b>{jobs.length}</b> Published alerts</span><span><b>{activeCount}</b> Open opportunities</span></div>
    </header>

    <section className="mu-jobs-toolbar">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search post, department or eligibility..." aria-label="Search job alerts" />
      <div className="mu-jobs-filters" role="group" aria-label="Filter job alerts">
        {(["open", "all", "closed"] as const).map(value => <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "open" ? "Open" : value === "all" ? "All" : "Closed"}</button>)}
      </div>
      <button type="button" className="mu-jobs-refresh" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
    </section>

    {error && <div className="mu-jobs-message" role="alert">{error} <button onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="mu-jobs-empty">Loading latest job alerts…</div> :
      visible.length === 0 ? <div className="mu-jobs-empty"><b>No job alerts found.</b><p>Try another search or check back later for new recruitment notices.</p></div> :
      <section className="mu-jobs-list" aria-label="Published job alerts">
        {visible.map(job => {
          const expired = isExpired(job.last_date);
          return <article className="mu-job-card" key={job.id}>
            <div className="mu-job-card-top"><span className={expired ? "mu-job-status closed" : "mu-job-status open"}>{expired ? "Deadline passed" : "Applications may be open"}</span><span className="mu-job-deadline">Last date: <b>{formatDate(job.last_date)}</b></span></div>
            <h2>{job.title}</h2>
            {job.organization && <p className="mu-job-org">{job.organization}</p>}
            {job.description && <p className="mu-job-description">{job.description}</p>}
            <div className="mu-job-card-bottom">
              <span>Verify eligibility and dates in the official notice.</span>
              {job.official_url && /^https?:\/\//i.test(job.official_url) && <a href={job.official_url} target="_blank" rel="noopener noreferrer">Official website / Apply ↗</a>}
            </div>
          </article>;
        })}
      </section>
    }
    <p className="mu-jobs-disclaimer">MISSION UNIFORM OP shares recruitment information for educational purposes. Always confirm the latest notification, eligibility, fees and deadlines on the official recruiting authority website before applying.</p>
  </main>;
}
