"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Profile() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) { router.replace("/login?next=/profile"); return; }
      const { data: { user }, error } = await sb.auth.getUser();
      if (error || !user) { router.replace("/login?next=/profile"); return; }
      const { data } = await sb.from("profiles").select("full_name, phone, created_at").eq("id", user.id).maybeSingle();
      if (!active) return;
      setName(data?.full_name || String(user.user_metadata?.full_name || ""));
      setPhone(data?.phone || user.phone || "");
      setEmail(user.email || "");
      setJoinedAt(data?.created_at || user.created_at || "");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  async function save() {
    const sb = supabaseBrowser();
    if (!sb) return;
    const cleanName = name.trim().replace(/\\s+/g, " ");
    if (cleanName.length < 2) {
      setErrorMessage("Please enter your full name (at least 2 characters).");
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("");
    setErrorMessage("");
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.replace("/login?next=/profile"); return; }
    const { error } = await sb.from("profiles").upsert({ id: user.id, full_name: cleanName }, { onConflict: "id" });
    if (error) setErrorMessage(error.message);
    else { setName(cleanName); setMessage("Your profile has been updated successfully."); }
    setSaving(false);
  }

  async function logout() {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const initials = name.trim()
    ? name.trim().split(/\\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()
    : "MU";
  const joinedLabel = joinedAt
    ? new Date(joinedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "Student account";

  if (loading) return <div className="mu-profile-loading"><span className="mu-profile-avatar">MU</span><p>Loading your student profile…</p></div>;

  return (
    <div className="mu-profile-page">
      <section className="mu-profile-hero">
        <div className="mu-profile-hero-top">
          <span className="mu-profile-kicker">MISSION UNIFORM OP · STUDENT ZONE</span>
          <span className="mu-profile-status"><i /> ACTIVE ACCOUNT</span>
        </div>
        <div className="mu-profile-identity">
          <div className="mu-profile-avatar" aria-label="Student initials">{initials}</div>
          <div className="mu-profile-heading">
            <h1>{name || "Student Name"}</h1>
            <p>Your preparation journey starts with discipline.</p>
            <span>✦ Member since {joinedLabel}</span>
          </div>
        </div>
        <div className="mu-profile-hero-foot">
          <span>🎯 Odisha Police & Government Exam Preparation</span>
          <span>आपकी वर्दी, आपका सपना।</span>
        </div>
      </section>

      <div className="mu-profile-layout">
        <section className="mu-profile-card mu-profile-details">
          <div className="mu-profile-card-heading">
            <div><span className="mu-profile-kicker-dark">YOUR ACCOUNT</span><h2>Personal Information</h2><p>Keep your student details correct and up to date.</p></div>
            <span className="mu-profile-card-icon">♙</span>
          </div>
          <label className="mu-profile-field">
            <span>Full Name <b>Editable</b></span>
            <input className="input" value={name} onChange={e => { setName(e.target.value); setMessage(""); setErrorMessage(""); }} placeholder="Enter your full name" autoComplete="name" />
            <small>Enter your name as you want it shown on your student account.</small>
          </label>
          <label className="mu-profile-field">
            <span>Registered Mobile Number <b>Verified login</b></span>
            <input className="input" value={phone || "Not available"} readOnly />
          </label>
          {email && <label className="mu-profile-field">
            <span>Email Address <b>Account email</b></span>
            <input className="input" value={email} readOnly />
          </label>}
          {errorMessage && <p className="mu-profile-feedback error" role="alert">{errorMessage}</p>}
          {message && <p className="mu-profile-feedback success" role="status">✓ {message}</p>}
          <div className="mu-profile-actions">
            <button className="btn primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving profile…" : "Save Profile Changes"}</button>
            <button className="mu-profile-logout" onClick={() => void logout()}>↪ Logout</button>
          </div>
        </section>

        <aside className="mu-profile-side">
          <section className="mu-profile-card mu-profile-security">
            <span className="mu-profile-card-icon">♢</span>
            <h2>Account Security</h2>
            <p>Your account is protected by your registered sign-in method. Never share your OTP with anyone.</p>
            <div className="mu-profile-security-row"><i /> Secure student session</div>
          </section>
          <section className="mu-profile-card mu-profile-shortcuts">
            <span className="mu-profile-kicker-dark">QUICK ACCESS</span>
            <h2>Continue Preparation</h2>
            <Link href="/dashboard"><span>▦</span><div><b>Student Dashboard</b><small>View your learning overview</small></div><strong>›</strong></Link>
            <Link href="/tests"><span>✎</span><div><b>Mock Tests</b><small>Practice and improve</small></div><strong>›</strong></Link>
            <Link href="/previous-papers"><span>▤</span><div><b>Previous Year Questions</b><small>Practice past exam papers</small></div><strong>›</strong></Link>
            <Link href="/history"><span>◷</span><div><b>Test History</b><small>Review your attempts</small></div><strong>›</strong></Link>
          </section>
        </aside>
      </div>
      <p className="mu-profile-help">Need help with your account? <Link href="/contact">Contact the MISSION UNIFORM OP team</Link>.</p>
    </div>
  );
}
