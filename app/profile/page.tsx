"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Stats = { attempts: number; completed: number; best: number; correct: number; wrong: number; accuracy: number };

export default function Profile() {
  const [name, setName] = useState("");
  const [display, setDisplay] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [lang, setLang] = useState("hi");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState("");
  const [stats, setStats] = useState<Stats>({ attempts: 0, completed: 0, best: 0, correct: 0, wrong: 0, accuracy: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) { router.replace("/login?next=/profile"); return; }
      const { data: { user }, error } = await sb.auth.getUser();
      if (error || !user) { router.replace("/login?next=/profile"); return; }
      const [{ data: profile }, { data: attempts }] = await Promise.all([
        sb.from("profiles").select("full_name,public_display_name,student_code,preferred_language,created_at").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("score,correct_count,wrong_count,total_questions,is_submitted").eq("user_id", user.id),
      ]);
      if (!live) return;
      setName(profile?.full_name || user.user_metadata?.full_name || "");
      setDisplay(profile?.public_display_name || "");
      setStudentCode(profile?.student_code || "");
      setLang(profile?.preferred_language || "hi");
      setPhone(user.phone || "");
      setEmail(user.email || "");
      setJoined(profile?.created_at || user.created_at || "");
      const all = attempts || [];
      const done = all.filter((x: any) => x.is_submitted);
      const correct = done.reduce((n: number, x: any) => n + Number(x.correct_count || 0), 0);
      const wrong = done.reduce((n: number, x: any) => n + Number(x.wrong_count || 0), 0);
      const total = done.reduce((n: number, x: any) => n + Number(x.total_questions || 0), 0);
      setStats({
        attempts: all.length,
        completed: done.length,
        best: done.reduce((n: number, x: any) => Math.max(n, Number(x.score || 0)), 0),
        correct, wrong, accuracy: total ? Math.round(correct / total * 100) : 0,
      });
      setLoading(false);
    })().catch(() => setLoading(false));
    return () => { live = false; };
  }, [router]);

  async function save() {
    const sb = supabaseBrowser();
    if (!sb) return;
    if (name.trim().length < 2) { setMsg("Please enter your full name."); return; }
    setSaving(true);
    setMsg("");
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.replace("/login?next=/profile"); return; }
    const { error } = await sb.from("profiles").upsert({
      id: user.id,
      full_name: name.trim(),
      public_display_name: display.trim() || null,
      preferred_language: lang,
    }, { onConflict: "id" });
    setMsg(error ? "Save failed: " + error.message : "Profile updated successfully.");
    setSaving(false);
  }

  async function logout() {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) return <div className="mu-profile-loading">Loading your student profile…</div>;

  return (
    <main className="mu-profile-simple">
      <section className="mu-profile-welcome">
        <div className="mu-profile-avatar">{(name[0] || "S").toUpperCase()}</div>
        <div className="mu-profile-welcome-copy">
          <span className="mu-profile-simple-kicker">MISSION UNIFORM OP · STUDENT PORTAL</span>
          <p className="mu-profile-overline">YOUR ACCOUNT</p>
          <h1>{name || "Student Cadet"}</h1>
          <p className="mu-profile-welcome-text">Manage your details and keep track of your preparation.</p>
          <span className="mu-profile-student-code">STUDENT ID · {studentCode || "Updating…"}</span>
        </div>
        <div className="mu-profile-welcome-links">
          <Link href="/dashboard">Dashboard <span>→</span></Link>
          <Link href="/student-messages">My Messages <span>→</span></Link>
        </div>
        <div className="mu-profile-welcome-foot"><span>LEARN</span><span>PRACTISE</span><span>SUCCEED</span></div>
      </section>

      <section className="mu-profile-simple-stats" aria-label="Your test progress">
        <article><b>{stats.attempts}</b><span>Tests attempted</span></article>
        <article><b>{stats.completed}</b><span>Completed</span></article>
        <article><b>{stats.best}</b><span>Best score</span></article>
        <article><b>{stats.accuracy}%</b><span>Accuracy</span></article>
      </section>

      <div className="mu-profile-simple-grid">
        <section className="mu-profile-simple-card">
          <div className="mu-profile-simple-heading"><span>ACCOUNT SETTINGS</span><h2>Personal Details</h2><p>Update the information shown on your student profile.</p></div>
          <div className="mu-profile-simple-fields">
            <label>Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" /></label>
            <label>Leaderboard display name<small>Visible to other students on the leaderboard.</small><input value={display} onChange={e => setDisplay(e.target.value)} maxLength={30} placeholder="Example: Cadet D" /></label>
            <label>Preferred language<select value={lang} onChange={e => setLang(e.target.value)}><option value="hi">हिन्दी</option><option value="en">English</option><option value="or">ଓଡ଼ିଆ</option></select></label>
            <label>Registered mobile<input value={phone || "Not linked"} readOnly /></label>
            <label>Email address<input value={email || "Not linked"} readOnly /></label>
          </div>
          <button className="mu-profile-simple-save" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
          {msg && <p className="mu-profile-simple-message" role="status">{msg}</p>}
        </section>

        <aside className="mu-profile-simple-card mu-profile-progress-card">
          <div className="mu-profile-simple-heading"><span>YOUR PROGRESS</span><h2>Keep Improving</h2><p>Your test performance at a glance.</p></div>
          <div className="mu-profile-simple-accuracy"><div><span>Answer accuracy</span><b>{stats.accuracy}%</b></div><i><em style={{ width: stats.accuracy + "%" }} /></i></div>
          <div className="mu-profile-simple-row"><span>✓ Correct answers</span><b>{stats.correct}</b></div>
          <div className="mu-profile-simple-row"><span>↻ Wrong answers</span><b>{stats.wrong}</b></div>
          <nav className="mu-profile-shortcuts">
            <Link href="/test-history">Test History <span>→</span></Link>
            <Link href="/leaderboard">Leaderboard <span>→</span></Link>
            <Link href="/tests">Practice Mock Tests <span>→</span></Link>
          </nav>
          {joined && <p className="mu-profile-joined">Member since {new Date(joined).toLocaleDateString("en-IN")}</p>}
        </aside>
      </div>

      <footer className="mu-profile-simple-footer">
        <span>Your email and mobile number are not displayed on the public leaderboard.</span>
        <button onClick={() => void logout()}>Sign Out</button>
      </footer>
    </main>
  );
}
