"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import PremiumTrialBanner from "@/components/premium-trial-banner";
import { EXAM_SUBJECTS } from "@/lib/exam-subjects";

type StudyInsights = { weakAreas: any[]; subjectPace: any[] };

const practiceLinks = [
  { href: "/subject-mock-test", icon: "📝", title: "Subject-wise Mock Tests", odia: "ବିଷୟଭିତ୍ତିକ ମକ୍ ଟେଷ୍ଟ", detail: "Choose a subject and practise with timed questions.", detailOd: "ବିଷୟ ବାଛନ୍ତୁ ଏବଂ ସମୟସୀମା ମଧ୍ୟରେ ପ୍ରଶ୍ନ ଅଭ୍ୟାସ କରନ୍ତୁ।" },
  { href: "/tests", icon: "📋", title: "Special Mock Tests", odia: "ସ୍ୱତନ୍ତ୍ର ମକ୍ ଟେଷ୍ଟ", detail: "Attempt practice papers published by the admin.", detailOd: "ଆଡମିନ୍ ପ୍ରକାଶ କରିଥିବା ଅଭ୍ୟାସ ପ୍ରଶ୍ନପତ୍ର ଦିଅନ୍ତୁ।" },
  { href: "/previous-papers", icon: "📚", title: "Previous Year Papers", odia: "ପୂର୍ବ ବର୍ଷର ପ୍ରଶ୍ନପତ୍ର", detail: "Practise with previous examination questions.", detailOd: "ପୂର୍ବ ପରୀକ୍ଷାର ପ୍ରଶ୍ନ ଅଭ୍ୟାସ କରନ୍ତୁ।" },
  { href: "/syllabus", icon: "📖", title: "Exam Syllabus", odia: "ପରୀକ୍ଷା ପାଠ୍ୟକ୍ରମ", detail: "Check subjects and topics before you prepare.", detailOd: "ପ୍ରସ୍ତୁତି ପୂର୍ବରୁ ବିଷୟ ଓ ଅଧ୍ୟାୟ ଦେଖନ୍ତୁ।" },
  { href: "/test-history", icon: "📊", title: "My Test History", odia: "ମୋ ଟେଷ୍ଟ ଇତିହାସ", detail: "Review your completed tests and scores.", detailOd: "ଆପଣଙ୍କ ଦିଆଯାଇଥିବା ଟେଷ୍ଟ ଓ ନମ୍ବର ଦେଖନ୍ତୁ।" },
  { href: "/leaderboard", icon: "🏆", title: "Performance Analysis", odia: "ପ୍ରଦର୍ଶନ ବିଶ୍ଳେଷଣ", detail: "Review your preparation and identify areas to improve.", detailOd: "ନିଜ ପ୍ରସ୍ତୁତି ଯାଞ୍ଚ କରନ୍ତୁ ଏବଂ ଉନ୍ନତି ଆବଶ୍ୟକ ଥିବା ବିଷୟ ଚିହ୍ନଟ କରନ୍ତୁ।" },
];

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [studyInsights, setStudyInsights] = useState<StudyInsights | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in to view your student dashboard.");
      const [{ data: profile }, { count }] = await Promise.all([
        sb.from("profiles").select("full_name,email,email_verified").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (!active) return;
      if (profile?.full_name) setName(profile.full_name);
      setEmail(profile?.email || user.email || "");
      setEmailVerified(!!profile?.email_verified);
      setAttempts(count || 0);
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData.session) {
        const response = await fetch("/api/study-insights", {
          headers: { Authorization: "Bearer " + sessionData.session.access_token },
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          if (active) setStudyInsights({ weakAreas: data.weakAreas || [], subjectPace: data.subjectPace || [] });
        }
      }
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
    <div className="mu-student-home" style={{ maxWidth: 1160, margin: "0 auto" }}>
      <section className="mu-student-hero" style={{ minHeight: 0 }}>
        <div className="mu-student-hero-copy" style={{ maxWidth: 760 }}>
          <span className="mu-kicker">MISSION UNIFORM OP · ODISHA POLICE EXAM PREPARATION</span>
          <p className="mu-student-greeting">WELCOME BACK, {name.toUpperCase()}</p>
          <h1>Prepare with practice.<br /><em>Be ready for the uniform.</em></h1>
          <p className="mu-student-hero-lead">
            Build your exam readiness with subject-wise mock tests, previous year papers and performance review.
            <br />
            <span lang="or">ବିଷୟଭିତ୍ତିକ ମକ୍ ଟେଷ୍ଟ, ପୂର୍ବ ବର୍ଷର ପ୍ରଶ୍ନପତ୍ର ଓ ପ୍ରଦର୍ଶନ ବିଶ୍ଳେଷଣ ମାଧ୍ୟମରେ ପରୀକ୍ଷା ପାଇଁ ପ୍ରସ୍ତୁତ ହୁଅନ୍ତୁ।</span>
          </p>
          <div className="mu-student-hero-stats">
            <div><b>{attempts}</b><span>Tests attempted · ଦିଆଯାଇଥିବା ଟେଷ୍ଟ</span></div>
            <div><b>FREE</b><span>Practice access · ମାଗଣା ଅଭ୍ୟାସ</span></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <Link href="/subject-mock-test" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 9, background: "#e8bd62", color: "#172f42", fontWeight: 800, textDecoration: "none" }}>
              Start Mock Test <span lang="or">· ଟେଷ୍ଟ ଆରମ୍ଭ କରନ୍ତୁ</span> →
            </Link>
            <Link href="/syllabus" style={{ display: "inline-flex", alignItems: "center", padding: "12px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,.45)", color: "white", fontWeight: 700, textDecoration: "none" }}>
              View Syllabus · ପାଠ୍ୟକ୍ରମ
            </Link>
          </div>
        </div>
        <div className="mu-student-field-activity" aria-hidden="true">
          <span className="mu-student-radar-ring ring-one" />
          <span className="mu-student-radar-ring ring-two" />
          <span className="mu-student-flight-path" />
          <span className="mu-student-flight">✦</span>
          <span className="mu-student-field-label">EXAM PRACTICE · ACTIVE</span>
        </div>
      </section>

      {!emailVerified && (
        <section role="status" style={{ margin: "18px auto", padding: "14px 16px", border: "1px solid #e7d8ad", borderRadius: 12, background: "#fffaf0", color: "#57451e", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <strong>Email verification pending · ଇମେଲ୍ ଯାଞ୍ଚ ବାକି ଅଛି</strong>
            <p style={{ margin: "5px 0 0", fontSize: 13 }}>{email ? "Verification link: " + email + "." : "Verify your email when convenient."} You can continue practising. <span lang="or">ଇମେଲ୍ ଯାଞ୍ଚ ନକରିଥିଲେ ମଧ୍ୟ ଅଭ୍ୟାସ ଜାରି ରଖିପାରିବେ।</span></p>
            {verifyMessage && <small>{verifyMessage}</small>}
          </div>
          <button type="button" onClick={sendVerification} disabled={verifyBusy} style={{ padding: "10px 15px", border: 0, borderRadius: 8, background: "#173b50", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            {verifyBusy ? "Sending…" : "Verify Email · ଇମେଲ୍ ଯାଞ୍ଚ"}
          </button>
        </section>
      )}
      {emailVerified && <p role="status" style={{ margin: "12px 0", color: "#17613b" }}>✓ Email verified · ଇମେଲ୍ ଯାଞ୍ଚ ହୋଇଛି</p>}

      <section style={{ margin: "26px 0 12px" }}>
        <div style={{ marginBottom: 14 }}>
          <span className="mu-kicker" style={{ color: "#9a742b" }}>YOUR EXAM PRACTICE</span>
          <h2 style={{ margin: "5px 0", color: "#173b50" }}>Choose your preparation area</h2>
          <p style={{ margin: 0, color: "#64748b" }} lang="or">ଆପଣଙ୍କ ପ୍ରସ୍ତୁତି ପାଇଁ ବିଷୟ କିମ୍ବା ଅଭ୍ୟାସ ବିଭାଗ ବାଛନ୍ତୁ।</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {practiceLinks.map(item => (
            <Link key={item.href} href={item.href} style={{ display: "block", padding: 17, border: "1px solid #dce4ea", borderRadius: 13, background: "#fff", color: "#173b50", textDecoration: "none", boxShadow: "0 5px 18px rgba(20,45,65,.045)" }}>
              <span style={{ fontSize: 25 }}>{item.icon}</span>
              <h3 style={{ margin: "9px 0 3px", fontSize: 17 }}>{item.title}</h3>
              <b style={{ display: "block", color: "#8a6729", fontSize: 13, fontWeight: 700 }} lang="or">{item.odia}</b>
              <p style={{ margin: "9px 0 4px", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{item.detail}</p>
              <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }} lang="or">{item.detailOd}</p>
              <span style={{ display: "inline-block", marginTop: 12, fontWeight: 800, fontSize: 13 }}>Open section →</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ margin: "28px 0", padding: 20, borderRadius: 14, background: "#f4f7f9", border: "1px solid #e0e7ec" }}>
        <h2 style={{ margin: "0 0 5px", color: "#173b50" }}>Exam subjects · ପରୀକ୍ଷାର ବିଷୟଗୁଡ଼ିକ</h2>
        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 13 }}>Select a subject to open its practice section. <span lang="or">ଅଭ୍ୟାସ ପାଇଁ ଏକ ବିଷୟ ବାଛନ୍ତୁ।</span></p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 9 }}>
          {EXAM_SUBJECTS.map(subject => (
            <Link key={subject.slug} href={"/subjects/" + subject.slug} style={{ padding: "12px 13px", background: "#fff", border: "1px solid #dce4ea", borderRadius: 10, textDecoration: "none", color: "#173b50" }}>
              <b>{subject.name}</b>
              <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#8a6729" }} lang="or">{subject.odia}</span>
            </Link>
          ))}
        </div>
      </section>

      {studyInsights && (
        <section style={{ margin: "20px 0", padding: 20, border: "1px solid #d8e1e8", borderRadius: 14, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#9a742b" }}>YOUR TEST PERFORMANCE</span>
              <h2 style={{ margin: "5px 0", color: "#173b50" }}>Smart Study Insights · ଅଧ୍ୟୟନ ବିଶ୍ଳେଷଣ</h2>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Guidance based on your mock test attempts. <span lang="or">ଆପଣଙ୍କ ମକ୍ ଟେଷ୍ଟ ଫଳାଫଳ ଆଧାରିତ ପରାମର୍ଶ।</span></p>
            </div>
            <Link href="/leaderboard" style={{ color: "#173b50", fontWeight: 700 }}>View analysis →</Link>
          </div>
          {studyInsights.weakAreas.length ? (
            <div style={{ marginTop: 16 }}>
              <b>Chapters to improve · ଉନ୍ନତି ଆବଶ୍ୟକ ଅଧ୍ୟାୟ</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 9 }}>
                {studyInsights.weakAreas.slice(0, 4).map((item: any, i: number) => (
                  <div key={i} style={{ padding: 12, borderRadius: 10, background: "#fff8ed", border: "1px solid #f0dfbf" }}>
                    <b>{item.chapter}</b><p style={{ margin: "4px 0", fontSize: 12, color: "#64748b" }}>{item.subject}</p>
                    <strong style={{ color: "#9a4d20" }}>{item.accuracy}% accuracy</strong>
                    <small style={{ display: "block", color: "#64748b" }}>{item.attempted} questions attempted</small>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ marginTop: 14, color: "#64748b" }}>Complete more chapter questions to see your improvement areas. <span lang="or">ନିଜର ଉନ୍ନତି ଦେଖିବା ପାଇଁ ଅଧିକ ପ୍ରଶ୍ନ ଅଭ୍ୟାସ କରନ୍ତୁ।</span></p>
          )}
          {studyInsights.subjectPace.length > 0 && (
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "#475569" }}>
              <b>Speed tip · ଗତି ପରାମର୍ଶ:</b> {studyInsights.subjectPace[0].subject} — {studyInsights.subjectPace[0].avgSecondsPerQuestion} seconds per question on average.
            </p>
          )}
        </section>
      )}

      <PremiumTrialBanner />

      <section className="mu-student-quote" style={{ marginTop: 26 }}>
        <span>YOUR DAILY TARGET · ଆଜିର ଲକ୍ଷ୍ୟ</span>
        <h2>Practise every day. Review every score. Improve every attempt.</h2>
        <p lang="or">ପ୍ରତିଦିନ ଅଭ୍ୟାସ କରନ୍ତୁ। ପ୍ରତ୍ୟେକ ଫଳାଫଳ ଯାଞ୍ଚ କରନ୍ତୁ। ପ୍ରତ୍ୟେକ ଚେଷ୍ଟାରେ ଉନ୍ନତି କରନ୍ତୁ।</p>
      </section>
      <p className="mu-student-signoff">MISSION UNIFORM OP <span>·</span> Odisha Police Exam Preparation · ଓଡ଼ିଶା ପୋଲିସ୍ ପରୀକ୍ଷା ପ୍ରସ୍ତୁତି</p>
    </div>
  );
}
