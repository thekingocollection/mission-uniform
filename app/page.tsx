"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const studyLinks = [
  { icon: "📝", title: "Mock Tests", desc: "Exam-style practice se apni taiyari parakhiye", href: "/tests", tone: "gold" },
  { icon: "📚", title: "Complete Syllabus", desc: "Har subject aur chapter ko step-by-step padhiye", href: "/syllabus", tone: "blue" },
  { icon: "🔔", title: "Latest Job Alerts", desc: "Nayi recruitment aur vacancy updates dekhiye", href: "/job-alerts", tone: "green" },
  { icon: "📄", title: "Previous Papers", desc: "Pichhle exam papers se pattern samajhiye", href: "/previous-papers", tone: "violet" },
  { icon: "📊", title: "Your Performance", desc: "Apne marks aur preparation progress dekhiye", href: "/performance", tone: "blue" },
  { icon: "👤", title: "Student Profile", desc: "Apna account aur learning journey sambhaliye", href: "/profile", tone: "gold" },
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
          <span className="mu-kicker">ODISHA POLICE · GOVERNMENT EXAM PREPARATION</span>
          <h1>Your Dream.<br /><em>Your Uniform.</em><br />Your Mission.</h1>
          <p className="mu-hero-lead">Sapna sirf naukri paane ka nahi — khaki vardi pehenkar desh aur samaj ki seva karne ka hai. Aapki taiyari ka safar yahin se shuru hota hai.</p>
          <div className="mu-hero-actions">
            <Link className="mu-btn mu-btn-gold" href="/signup">Start Your Preparation <span>→</span></Link>
            <Link className="mu-btn mu-btn-light" href="/login">Already a Student? Login</Link>
          </div>
          <div className="mu-hero-note"><span>✓ Free student registration</span><span>✓ Practice anytime</span><span>✓ Track your progress</span></div>
        </div>
        <div className="mu-hero-emblem" aria-hidden="true">
          <div className="mu-emblem-ring"><span>MISSION</span><b>MU</b><span>UNIFORM OP</span></div>
          <small>DISCIPLINE · DEDICATION · SUCCESS</small>
        </div>
      </section>

      <section className="mu-motivation-banner">
        <span className="mu-motivation-top">EK LAKSHYA · EK JUNOON</span>
        <h2>Ek din vardi aapki hogi!</h2>
        <p>Aaj ki mehnat, kal ki pehchaan. Har din thoda padhiye, har test se kuch naya seekhiye aur apne sapne ki taraf badhte rahiye.</p>
        <Link className="mu-btn mu-btn-gold" href="/signup">Aaj hi shuruaat karein →</Link>
      </section>

      <section className="mu-welcome-row">
        <div><span className="mu-kicker">YOUR PREPARATION HUB</span><h2>Selection ki taiyari, ek hi platform par</h2><p>Chhote daily goals banaiye, regular practice kijiye aur apni performance behtar banaiye.</p></div>
        <div className="mu-live-count"><b>{published}</b><span>Published mock tests</span></div>
      </section>

      <section className="mu-feature-grid">
        {studyLinks.map(item => <Link className="mu-feature-card" href={item.href} key={item.href}>
          <span className={"mu-feature-icon " + item.tone}>{item.icon}</span>
          <span className="mu-feature-title">{item.title}</span>
          <span className="mu-feature-desc">{item.desc}</span>
          <span className="mu-feature-go">Explore now <b>↗</b></span>
        </Link>)}
      </section>

      <section className="mu-quick-strip">
        <div><span className="mu-kicker">YOUR JOURNEY STARTS TODAY</span><h2>Rukiye mat. Roz seekhiye. Aage badhiye.</h2><p>Free student account banakar apne test attempts save karein, answers review karein aur apni progress dekhein.</p></div>
        <Link className="mu-btn mu-btn-gold" href="/signup">Create Free Account →</Link>
      </section>
      <p className="mu-home-signoff">MISSION UNIFORM OP <span>·</span> Your Dream. Your Uniform. Your Mission.</p>
    </div>
  );
}
