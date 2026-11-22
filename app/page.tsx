"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";
import { EXAM_SUBJECTS } from "@/lib/exam-subjects";

const studyLinks = [
  { icon: "🎯", title: "Mock Tests", desc: "Practice with exam-style questions and build your confidence.", href: "/tests", tone: "gold", code: "01" },
  { icon: "🧭", title: "Complete Syllabus", desc: "Explore every subject and chapter with a clear study path.", href: "/syllabus", tone: "olive", code: "02" },
  { icon: "📡", title: "Latest Job Alerts", desc: "Stay informed about recruitment notices and vacancies.", href: "/job-alerts", tone: "steel", code: "03" },
  { icon: "📁", title: "Previous Papers", desc: "Understand the exam pattern with previous year papers.", href: "/previous-papers", tone: "sand", code: "04" },
  { icon: "📈", title: "Your Performance", desc: "Review your scores and track your preparation progress.", href: "/performance", tone: "steel", code: "05" },
  { icon: "🪪", title: "Student Profile", desc: "Manage your account and keep your learning journey on track.", href: "/profile", tone: "olive", code: "06" },
];

export default function HomePage() {
  const router = useRouter();
  const [published, setPublished] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;
    const sb = supabaseBrowser();
    if (!sb) {
      setCheckingAuth(false);
      return;
    }

    sb.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) router.replace("/dashboard");
      else setCheckingAuth(false);
    });

    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) router.replace("/dashboard");
      else setCheckingAuth(false);
    });

    sb.from("test_papers").select("id", { count: "exact", head: true }).eq("status", "published")
      .then(({ count }) => { if (active) setPublished(count || 0); });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="mu-home mu-home--defence">
      <section className="mu-defence-hero">
        <div className="mu-defence-gridlines" aria-hidden="true" />
        <div className="mu-tricolour-flypast" aria-hidden="true">
          <span className="mu-flypast-plane mu-flypast-one">✈</span>
          <span className="mu-flypast-plane mu-flypast-two">✈</span>
          <span className="mu-flypast-plane mu-flypast-three">✈</span>
        </div>
        <div className="mu-defence-copy">
          <div className="mu-defence-overline"><span className="mu-live-dot" /> ODISHA POLICE · EXAM PREPARATION COMMAND</div>
          <div className="mu-defence-classification">CADET TRAINING PORTAL <span> / </span> EST. FOR YOUR SUCCESS</div>
          <h1>THE CALL TO<br /><em>WEAR THE UNIFORM.</em></h1>
          <p className="mu-defence-lead">Khaki sirf ek vardi nahi, zimmedari aur seva ka sankalp hai. Discipline ke saath taiyari shuru kijiye — aapka mission aaj se shuru hota hai.</p>
          <div className="mu-defence-actions">
            <Link className="mu-defence-btn mu-defence-btn-primary" href="/signup">ENLIST / REGISTER <span>↗</span></Link>
            <Link className="mu-defence-btn mu-defence-btn-outline" href="/login">CADET LOGIN <span>→</span></Link>
          </div>
          <div className="mu-defence-assurances">
            <span><b>✓</b> FREE STUDENT ACCESS</span>
            <span><b>✓</b> PRACTICE ANYTIME</span>
            <span><b>✓</b> TRACK YOUR PROGRESS</span>
          </div>
        </div>
        <div className="mu-defence-visual" aria-label="MISSION UNIFORM OP three dimensional shield emblem">
          <div className="mu-defence-orbit mu-orbit-one" />
          <div className="mu-defence-orbit mu-orbit-two" />
          <div className="mu-defence-crosshair mu-crosshair-a" />
          <div className="mu-defence-crosshair mu-crosshair-b" />
          <div className="mu-defence-shield-wrap">
            <div className="mu-defence-shield-shadow" />
            <div className="mu-defence-shield">
              <div className="mu-defence-shield-inner">
                <span className="mu-shield-top">MISSION</span>
                <b>MU</b>
                <span className="mu-shield-star">★</span>
                <span className="mu-shield-bottom">UNIFORM OP</span>
              </div>
            </div>
          </div>
          <div className="mu-defence-visual-caption"><span>DISCIPLINE</span><i /> <span>COURAGE</span><i /> <span>SERVICE</span></div>
          <span className="mu-defence-coordinate mu-coord-top">OD / 20.29° N</span>
          <span className="mu-defence-coordinate mu-coord-bottom">MISSION STATUS: ACTIVE</span>
        </div>
        <div className="mu-defence-hero-foot"><span>01 — PREPARE</span><span>02 — PRACTICE</span><span>03 — PERSEVERE</span><span className="mu-defence-foot-right">YOUR MISSION STARTS HERE</span></div>
      </section>

      <PremiumTrialBanner />

      <section className="mu-defence-motto">
        <div className="mu-defence-motto-mark">“</div>
        <div><span className="mu-defence-section-tag">THE CADET CODE</span><h2>Discipline today. Pride in uniform tomorrow.</h2><p>Har din ka ek focused step aapko apne lakshya ke kareeb le jaata hai.</p></div>
        <div className="mu-defence-motto-seal">SERVICE<br /><b>★</b><br />HONOUR</div>
      </section>

      <section className="mu-important-topics">
        <div className="mu-defence-section-head">
          <div><span className="mu-defence-section-tag">MISSION CONTROL / 02</span><h2>Important exam topics</h2><p>Build strong fundamentals across the key Odisha Police preparation subjects.</p></div>
        </div>
        <div className="mu-topic-grid">
          {EXAM_SUBJECTS.map((subject, index) => <article key={subject.slug}><b>{String(index+1).padStart(2,"0")}</b><span>{subject.name.toUpperCase()}</span><small>{subject.description}</small></article>)}
        </div>
      </section>

      <section className="mu-defence-briefing">
        <div className="mu-defence-section-head">
          <div><span className="mu-defence-section-tag">MISSION CONTROL / 01</span><h2>Your preparation command center</h2><p>Choose your next training module and keep moving forward.</p></div>
          <div className="mu-defence-live-count"><span className="mu-live-dot" /><b>{published}</b><small>LIVE MOCK TESTS</small></div>
        </div>
        <div className="mu-defence-modules">
          {studyLinks.map(item => <Link className="mu-defence-module" href={item.href} key={item.href}>
            <div className="mu-defence-module-top"><span className={"mu-defence-module-icon " + item.tone}>{item.icon}</span><span className="mu-defence-module-code">MODULE / {item.code}</span></div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <div className="mu-defence-module-bottom"><span>OPEN MODULE</span><b>↗</b></div>
          </Link>)}
        </div>
      </section>

      <section className="mu-defence-final">
        <div><span className="mu-defence-section-tag">YOUR DUTY BEGINS WITH PREPARATION</span><h2>One goal. One uniform. One mission.</h2><p>Create your free student account and begin your preparation journey today.</p></div>
        <Link className="mu-defence-btn mu-defence-btn-primary" href="/signup">BEGIN YOUR MISSION <span>→</span></Link>
      </section>
      <footer className="mu-defence-footer"><span>MISSION UNIFORM OP</span><i /> <span>YOUR DREAM. YOUR UNIFORM. YOUR MISSION.</span></footer>
    </main>
  );
}
