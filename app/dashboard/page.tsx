"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";
import { createFcmToken } from "@/lib/firebase";
import StudentWebsiteTour from "@/components/student-website-tour";

const dashboardLinks = [
  { href: "/subject-mock-test", icon: "✦", title: "Subject Mock Tests", description: "Practice topic by topic and improve your score.", tag: "MOST POPULAR" },
  { href: "/tests", icon: "▤", title: "Special Mock Tests", description: "Attempt complete exam-style practice papers.", tag: "PRACTICE" },
  { href: "/previous-papers", icon: "◫", title: "Previous Year Papers", description: "Understand the exam pattern with past papers.", tag: "PYQ" },
  { href: "/syllabus", icon: "☷", title: "Exam Syllabus", description: "Check all subjects and important topics.", tag: "LEARN" },
  { href: "/test-history", icon: "◷", title: "Test History", description: "See your completed tests and scores.", tag: "YOUR RECORD" },
  { href: "/leaderboard", icon: "↗", title: "Performance", description: "Track your preparation and progress.", tag: "PROGRESS" },
  { href: "/feedback", icon: "★", title: "Feedback & Survey", description: "Share your experience and unlock one subject free for 3 days.", tag: "3 DAYS FREE" },
];

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [studentId, setStudentId] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      setStudentId(user.id);
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

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationEnabled(Notification.permission === "granted");
    }
  }, []);

  const enableNotifications = async () => {
    setNotificationBusy(true);
    setNotificationMessage("");
    try {
      const token = await createFcmToken();
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error("Please sign in again to enable notifications.");
      const response = await fetch("/api/student/fcm-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({
          token,
          platform: /Android/i.test(navigator.userAgent) ? "android-web" : "web",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save notification settings.");
      setNotificationEnabled(true);
      setNotificationMessage("Notifications are enabled on this device.");
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setNotificationBusy(false);
    }
  };

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
      <StudentWebsiteTour userId={studentId} />
      <section className="mu-dashboard-welcome" data-tour="welcome">
        <div className="mu-dashboard-welcome-copy">
          <span className="mu-dashboard-eyebrow"><i /> MISSION UNIFORM OP · STUDENT PORTAL</span>
          <p className="mu-dashboard-welcome-label">WELCOME BACK</p>
          <h1>{name}<br /><em>Your mission starts here.</em></h1>
          <p className="mu-dashboard-intro">Prepare for Odisha Police with focused practice, mock tests and daily progress.</p>
          <div className="mu-dashboard-actions">
            <Link href="/subject-mock-test" className="mu-dashboard-primary">Start Mock Test <span>↗</span></Link>
            <Link href="/leaderboard" className="mu-dashboard-secondary">View Leaderboard <span>→</span></Link>
          </div>
        </div>
        <div className="mu-dashboard-emblem" aria-hidden="true">
          <div className="mu-dashboard-emblem-ring"><div className="mu-dashboard-emblem-core"><span>★</span><b>MU</b><small>UNIFORM OP</small></div></div>
          <p>DISCIPLINE · COURAGE · SERVICE</p>
        </div>
        <div className="mu-dashboard-welcome-foot"><span>01 / PREPARE</span><span>02 / PRACTICE</span><span>03 / SUCCEED</span></div>
      </section>

      <PremiumTrialBanner />

      <section
        aria-label="Notification settings"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          margin: "18px 0",
          padding: "18px 20px",
          border: "1px solid #d8e3ef",
          borderRadius: 16,
          background: "linear-gradient(120deg, #f7fbff, #ffffff)",
        }}
      >
        <div style={{ minWidth: 220, flex: "1 1 260px" }}>
          <b style={{ display: "block", fontSize: 16, color: "#142b45" }}>🔔 Study & Exam Notifications</b>
          <p style={{ margin: "5px 0 0", color: "#526579", fontSize: 13 }}>
            Get important exam updates, new mock test alerts and study reminders on this device.
          </p>
          {notificationMessage && (
            <small role="status" style={{ display: "block", marginTop: 8, color: notificationEnabled ? "#167044" : "#9a4b16" }}>
              {notificationMessage}
            </small>
          )}
        </div>
        <button
          type="button"
          onClick={enableNotifications}
          disabled={notificationBusy || notificationEnabled}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "11px 17px",
            background: notificationEnabled ? "#e5f5ec" : "#173e68",
            color: notificationEnabled ? "#17633d" : "#ffffff",
            fontWeight: 700,
            cursor: notificationBusy || notificationEnabled ? "default" : "pointer",
            opacity: notificationBusy ? 0.7 : 1,
          }}
        >
          {notificationBusy ? "Enabling…" : notificationEnabled ? "✓ Notifications Enabled" : "Enable Notifications"}
        </button>
      </section>

      {!emailVerified && (
        <section className="mu-dashboard-email" role="status">
          <div><b>Email verification pending</b><p>{email ? "Verification link will be sent to " + email + "." : "Verify your email to keep your account details up to date."} You can continue practising.</p>{verifyMessage && <small>{verifyMessage}</small>}</div>
          <button type="button" onClick={sendVerification} disabled={verifyBusy}>{verifyBusy ? "Sending…" : "Verify Email"}</button>
        </section>
      )}

      <section className="mu-dashboard-overview" data-tour="overview">
        <div><span className="mu-dashboard-section-kicker">YOUR PREPARATION</span><h2>Ready for today’s practice?</h2><p>Keep learning one step at a time.</p></div>
        <div className="mu-dashboard-attempts"><b>{attempts}</b><span>Tests attempted</span></div>
      </section>

      <section className="mu-dashboard-links" aria-label="Student study sections">
        {dashboardLinks.map((item, index) => (
          <Link href={item.href} className="mu-dashboard-link-card" key={item.href} data-tour={item.href === "/subject-mock-test" ? "subject" : item.href === "/tests" ? "mock" : item.href === "/previous-papers" ? "papers" : item.href === "/syllabus" ? "syllabus" : item.href === "/test-history" ? "history" : undefined}>
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
