"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-client-session";

type Activity = { id: string; kind: "registration" | "purchase"; user_id: string; name: string; student_code?: string; amount_paise?: number; created_at: string; reference?: string };

export default function AdminHome() {
  const [stats, setStats] = useState({ students: 0, subjects: 0, questions: 0, tests: 0, attempts: 0, jobs: 0 });
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityError, setActivityError] = useState("");
  const [celebration, setCelebration] = useState<Activity | null>(null);
  const lastChecked = useRef<string>(new Date().toISOString());
  const seen = useRef<Set<string>>(new Set());

  const loadActivity = useCallback(async (isFirst = false) => {
    try {
      const since = isFirst ? "" : lastChecked.current;
      const response = await adminFetch("/api/admin/activity-feed" + (since ? "?since=" + encodeURIComponent(since) : ""));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Activity feed load nahi hua.");
      const events: Activity[] = data.events || [];
      if (isFirst) {
        events.forEach(event => seen.current.add(event.id));
        setActivity(events.slice(0, 8));
      } else {
        const fresh = events.filter(event => !seen.current.has(event.id));
        fresh.forEach(event => seen.current.add(event.id));
        if (fresh.length) {
          setActivity(previous => [...fresh, ...previous].slice(0, 12));
          const newest = fresh[0];
          setCelebration(newest);
          window.setTimeout(() => setCelebration(current => current?.id === newest.id ? null : current), 6500);
        }
      }
      lastChecked.current = data.checked_at || new Date().toISOString();
      setActivityError("");
    } catch (error: any) {
      setActivityError(error.message || "Activity feed unavailable.");
    }
  }, [sb]);

  useEffect(() => {
    let live = true;
    (async () => {
      const tables = ["profiles", "subjects", "questions", "test_papers", "attempts", "job_alerts"] as const;
      // Use the same server-authorized profile count as the Student Management page.
      const studentResponse = await adminFetch("/api/admin/student-management");
      const studentData = await studentResponse.json();
      const vals = await Promise.all(tables.slice(1).map(table => sb.from(table).select("id", { count: "exact", head: true })));
      if (live) {
        setStats({
          students: studentResponse.ok ? Number(studentData.total ?? studentData.students?.length ?? 0) : 0,
          subjects: vals[0]?.count || 0,
          questions: vals[1]?.count || 0,
          tests: vals[2]?.count || 0,
          attempts: vals[3]?.count || 0,
          jobs: vals[4]?.count || 0
        });
        setLoading(false);
      }
    })();
    void loadActivity(true);
    const timer = window.setInterval(() => { void loadActivity(false); }, 15000);
    return () => { live = false; window.clearInterval(timer); };
  }, [loadActivity]);

  const cards = [
    ["Registered Students", stats.students, "/admin/students", "♙"], ["Subjects", stats.subjects, "/admin/subjects", "▤"],
    ["Question Bank", stats.questions, "/admin/questions", "✎"], ["Mock Tests", stats.tests, "/admin/tests", "◷"],
    ["Test Attempts", stats.attempts, "/admin/students", "▥"], ["Job Alerts", stats.jobs, "/admin/job-alerts", "⌕"],
    ["Finance Report", "View sales & revenue", "/admin/finance-report", "₹"]
  ];

  return <>
    <div className="admin-page-heading"><div><span className="admin-kicker">COMMAND OVERVIEW</span><h1>Super Admin Dashboard</h1><p>Manage the learning platform, student access and published content.</p></div><span className="admin-date">V2 · CONTROL CENTRE</span></div>
    <div className="admin-stat-grid">{cards.map(card => <Link href={card[2] as string} className="admin-stat-card" key={card[0] as string}><span>{card[3]}</span><small>{card[0]}</small><b>{loading ? "—" : card[1]}</b><em>Open module →</em></Link>)}</div>

    <section className="mu-admin-activity-panel">
      <div className="mu-admin-activity-head"><div><span className="admin-kicker">LIVE COMMAND FEED</span><h2>New Registrations & Purchases</h2><p>New student registrations and successful payments appear automatically.</p></div><span className="mu-admin-live"><i /> LIVE · 15 SEC</span></div>
      {activityError && <p className="admin-muted">{activityError}</p>}
      <div className="mu-admin-activity-list" aria-live="polite">
        {activity.map(item => <article key={item.id} className={"mu-admin-activity-item " + item.kind}>
          <span className="mu-admin-activity-icon">{item.kind === "purchase" ? "₹" : "♙"}</span>
          <div><b>{item.kind === "purchase" ? "New purchase received" : "New member registered"}</b><p>{item.kind === "purchase" ? item.name + " · ₹" + ((item.amount_paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : item.name + (item.student_code ? " · " + item.student_code : "")}</p><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></div>
          <span className="mu-admin-activity-kind">{item.kind === "purchase" ? "PAID" : "WELCOME"}</span>
        </article>)}
        {!activity.length && !activityError && <div className="mu-admin-activity-empty">No recent activity yet. New registrations and successful purchases will appear here.</div>}
      </div>
    </section>

    {celebration && <div className={"mu-admin-celebration " + celebration.kind} role="status" aria-live="assertive">
      {celebration.kind === "purchase" ? <div className="mu-money-rain" aria-hidden="true"><i>₹</i><i>₹</i><i>₹</i><i>₹</i><i>✦</i><i>₹</i><i>₹</i><i>✦</i></div> : <div className="mu-welcome-sparkles" aria-hidden="true">✦　✧　✦</div>}
      <button type="button" className="mu-admin-celebration-close" onClick={() => setCelebration(null)} aria-label="Close celebration">×</button>
      <span className="mu-admin-celebration-icon">{celebration.kind === "purchase" ? "₹" : "♙"}</span>
      <small>{celebration.kind === "purchase" ? "PAYMENT SUCCESSFUL" : "NEW CADET JOINED"}</small>
      <h2>{celebration.kind === "purchase" ? "New Purchase!" : "Welcome to the Mission!"}</h2>
      <p>{celebration.kind === "purchase" ? celebration.name + " · ₹" + ((celebration.amount_paise || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " received" : "Welcome, " + celebration.name + "! A new member has joined MISSION UNIFORM OP."}</p>
      <span className="mu-admin-celebration-footer">{celebration.kind === "purchase" ? "YOUR PLATFORM IS GROWING" : "ONE DREAM · ONE UNIFORM · ONE MISSION"}</span>
    </div>}

    <div className="admin-dashboard-grid">
      <section className="admin-panel"><h2>Quick Actions</h2><div className="admin-quick-grid">
        <Link href="/admin/questions">＋ Add / Bulk Import Questions</Link><Link href="/admin/tests">＋ Create Mock Test / Previous Year Mock</Link>
        <Link href="/admin/previous-papers">＋ Upload Previous Year PDF</Link><Link href="/admin/subject-mock-tests">◎ Subject-wise Mock Tests</Link>
        <Link href="/admin/job-alerts">＋ Publish Job Alert</Link><Link href="/admin/notifications">＋ Send Announcement</Link><Link href="/admin/feedback">★ View Reviews & Surveys</Link>
        <Link href="/admin/subjects">＋ Manage Subjects</Link><Link href="/admin/finance-report">₹ Finance Report & Sales</Link>
        <Link href="/admin/sponsor-ads">▣ Manage Sponsor Banners</Link><Link href="/admin/settings">⚙ Website Settings</Link>
      </div></section>
      <section className="admin-panel"><h2>Security Status</h2><div className="admin-security-row"><i/> Super Admin role verification active</div><div className="admin-security-row"><i/> Database policies required for all writes</div><div className="admin-security-row"><i/> Student role cannot access admin modules</div><p className="admin-muted">All counts are read from Supabase. Empty or unavailable tables may display zero; check migrations and permissions if counts do not load.</p></section>
    </div>
  </>;
}
