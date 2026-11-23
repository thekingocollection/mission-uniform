"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";

const dashboardLinks = [
  { href: "/subject-mock-test", icon: "✦", title: "Subject Mock Tests", description: "Practice topic by topic and improve your score.", tag: "MOST POPULAR" },
  { href: "/tests", icon: "▤", title: "Special Mock Tests", description: "Attempt complete exam-style practice papers.", tag: "PRACTICE" },
  { href: "/previous-papers", icon: "◫", title: "Previous Year Papers", description: "Understand the exam pattern with past papers.", tag: "PYQ" },
  { href: "/syllabus", icon: "☷", title: "Exam Syllabus", description: "Check all subjects and important topics.", tag: "LEARN" },
  { href: "/test-history", icon: "◷", title: "Test History", description: "See your completed tests and scores.", tag: "YOUR RECORD" },
  { href: "/leaderboard", icon: "↗", title: "Performance", description: "Track your preparation and progress.", tag: "PROGRESS" },
];

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { count }] = await Promise.all([
        sb.from("profiles").select("full_name,email,email_verified").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (!active) return;
      setName(profile?.full_name || user.user_metadata?.full_name || "Student");
      setEmail(profile?.email || user.email || "");
      setEmailVerified(!!profile?.email_verified);
      setAttempts(count || 0);
    })().catch(() => {
      if (active) setName("Student");
    });
    return () => { active = false; };
  }, []);

  const sendVerification = async () => {
    setVerifyBusy(true);
    setVerifyMessage("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in again to verify your email.");
      const response = await fetch("/api/email-verification/send", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send the verification email.");
      setVerifyMessage("Verification link sent. Please check your inbox.");
    } catch (error) {
      setVerifyMessage(error instanceof Error ? error.message : "Could not send the verification email.");
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <main className="mu-dashboard-simple">
      <section className="mu-dashboard-welcome">
        <div className="mu-dashboard-welcome-copy">
          <span className="mu-dashboard-eyebrow"><i /> MISSION UNIFORM OP · STUDENT PORTAL</span>
          <p className="mu-dashboard-welcome-label">WELCOME BACK</p>
          <h1>{name}<br /><em>Your mission starts here.</em></h1>
          <p className="mu-dashboard-intro">Prepare for Odisha Police with focused practice, mock tests and daily progress.</p>
          <div className="mu-dashboard-actions">
            <Link href="/subject-mock-test" className="mu-dashboard-primary">Start Mock Test <span>↗</span></Link>
            <Link href="/syllabus" className="mu-dashboard-secondary">View Syllabus <span>→</span></Link>
          </div>
        </div>
        <div className="mu-dashboard-emblem" aria-hidden="true">
          <div className="mu-dashboard-emblem-ring"><div className="mu-dashboard-emblem-core"><span>★</span><b>MU</b><small>UNIFORM OP</small></div></div>
          <p>DISCIPLINE · COURAGE · SERVICE</p>
        </div>
        <div className="mu-dashboard-welcome-foot"><span>01 / PREPARE</span><span>02 / PRACTICE</span><span>03 / SUCCEED</span></div>
      </section>

      <PremiumTrialBanner />

      {!emailVerified && (
        <section className="mu-dashboard-email" role="status">
          <div><b>Email verification pending</b><p>{email ? "Verification link will be sent to " + email + "." : "Verify your email to keep your account details up to date."} You can continue practising.</p>{verifyMessage && <small>{verifyMessage}</small>}</div>
          <button type="button" onClick={sendVerification} disabled={verifyBusy}>{verifyBusy ? "Sending…" : "Verify Email"}</button>
        </section>
      )}

      <section className="mu-dashboard-overview">
        <div><span className="mu-dashboard-section-kicker">YOUR PREPARATION</span><h2>Ready for today’s practice?</h2><p>Keep learning one step at a time.</p></div>
        <div className="mu-dashboard-attempts"><b>{attempts}</b><span>Tests attempted</span></div>
      </section>

      <section className="mu-dashboard-links" aria-label="Student study sections">
        {dashboardLinks.map((item, index) => (
          <Link href={item.href} className="mu-dashboard-link-card" key={item.href}>
            <div className="mu-dashboard-card-top"><span className="mu-dashboard-card-icon">{item.icon}</span><span className="mu-dashboard-card-tag">{item.tag}</span></div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="mu-dashboard-card-open">OPEN SECTION <b>↗</b></span>
          </Link>
        ))}
      </section>

      <section className="mu-dashboard-quote">
        <span>YOUR DAILY MISSION</span>
        <h2>Practise every day. Get closer to your uniform.</h2>
        <p>MISSION UNIFORM OP · Odisha Police Exam Preparation</p>
      </section>
    </main>
  );
}
