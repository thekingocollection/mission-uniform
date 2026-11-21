"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const studyLinks = [
  { icon: "📝", title: "Mock Tests", desc: "Daily, subject aur full mock practice", href: "/tests", tone: "gold" },
  { icon: "📚", title: "Syllabus", desc: "Odisha Police topics aur chapters", href: "/syllabus", tone: "blue" },
  { icon: "📢", title: "Job Alerts", desc: "Recruitment aur official vacancy updates", href: "/job-alerts", tone: "green" },
  { icon: "📄", title: "Previous Papers", desc: "Purane exam papers se practice", href: "/previous-papers", tone: "violet" },
  { icon: "📊", title: "Performance", desc: "Apni preparation progress dekhein", href: "/performance", tone: "blue" },
  { icon: "👤", title: "Student Profile", desc: "Apna account aur details", href: "/profile", tone: "gold" },
];

export default function HomePage() {
  const [published, setPublished] = useState(0);
  useEffect(() => {
    let active = true;
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.from("test_papers").select("id", { count: "exact", head: true }).eq("status", "published")
      .then(({ count }) => { if (active) setPublished(count || 0); });
    return () => { active = false; };
  }, []);

  return (
    <div className="mu-home">
      <section className="mu-hero">
        <div className="mu-hero-copy">
          <span className="mu-kicker">ODISHA POLICE · GOVERNMENT EXAMS</span>
          <h1>Your Dream.<br /><em>Your Uniform.</em><br />Your Mission.</h1>
          <p>Smart preparation, mock tests, syllabus aur job alerts — sab kuch ek hi jagah. Hindi, Odia aur English learners ke liye.</p>
          <div className="mu-hero-actions">
            <Link className="mu-btn mu-btn-gold" href="/tests">Start Mock Test <span>→</span></Link>
            <Link className="mu-btn mu-btn-light" href="/signup">Create Free Account</Link>
          </div>
          <div className="mu-hero-note"><span>✓ Mobile friendly</span><span>✓ Practice anytime</span><span>✓ Track progress</span></div>
        </div>
        <div className="mu-hero-emblem" aria-hidden="true">
          <div className="mu-emblem-ring"><span>MISSION</span><b>MU</b><span>UNIFORM OP</span></div>
          <small>DISCIPLINE · DEDICATION · SUCCESS</small>
        </div>
      </section>

      <section className="mu-welcome-row">
        <div><span className="mu-kicker">YOUR PREPARATION HUB</span><h2>Choose what you want to study today</h2><p>Start with a small daily practice and keep improving.</p></div>
        <div className="mu-live-count"><b>{published}</b><span>Published mock tests</span></div>
      </section>

      <section className="mu-feature-grid">
        {studyLinks.map(item => <Link className="mu-feature-card" href={item.href} key={item.href}>
          <span className={"mu-feature-icon " + item.tone}>{item.icon}</span>
          <span className="mu-feature-title">{item.title}</span>
          <span className="mu-feature-desc">{item.desc}</span>
          <span className="mu-feature-go">Open section <b>↗</b></span>
        </Link>)}
      </section>

      <section className="mu-quick-strip">
        <div><span className="mu-kicker">STAY CONSISTENT</span><h2>Practice today. Perform better tomorrow.</h2><p>Login to save your attempts, review answers and see your progress.</p></div>
        <Link className="mu-btn mu-btn-gold" href="/dashboard">Open Student Dashboard →</Link>
      </section>
    </div>
  );
}
