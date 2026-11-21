"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextPath, setNextPath] = useState("/dashboard");
  const router = useRouter();
  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const validName = name.trim().length >= 2;

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setNextPath(next);
    }
  }, []);

  function destination() {
    return nextPath;
  }

  async function send() {
    if (mode === "signup" && !validName) { setMsg("Please enter your full name."); return; }
    if (!validPhone) { setMsg("Enter a valid 10-digit Indian mobile number."); return; }
    setBusy(true); setMsg("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase configuration is missing.");
      const { error } = await sb.auth.signInWithOtp({
        phone: "+91" + phone,
        options: { shouldCreateUser: mode === "signup", data: { full_name: name.trim() } },
      });
      if (error) throw error;
      setSent(true); setMsg("OTP sent successfully. Please check your mobile.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send OTP.");
    } finally { setBusy(false); }
  }

  async function verify() {
    if (otp.length !== 6) { setMsg("Please enter the 6-digit OTP."); return; }
    setBusy(true); setMsg("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase configuration is missing.");
      const { data, error } = await sb.auth.verifyOtp({ phone: "+91" + phone, token: otp, type: "sms" });
      if (error) throw error;
      if (!data.user) throw new Error("User account could not be verified.");
      if (mode === "signup") {
        const { error: profileError } = await sb.from("profiles").upsert(
          { id: data.user.id, full_name: name.trim() }, { onConflict: "id" }
        );
        if (profileError) throw new Error("Account verified, but profile could not be saved: " + profileError.message);
      }
      router.replace(destination());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "OTP verification failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="auth-card">
      <span className="eyebrow">MISSION UNIFORM OP · STUDENT PORTAL</span>
      <h1>{mode === "login" ? "Welcome Back!" : "Create Your Student Account"}</h1>
      <p>{mode === "login" ? "Already registered? Login with your registered mobile number." : "Register free to access mock tests, syllabus, results and your student dashboard."}</p>
      {mode === "signup" && <label>Full Name *<input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" autoComplete="name" required disabled={sent}/></label>}
      <label>Mobile Number *<div className="phone-input"><span>+91</span><input type="tel" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit mobile number" inputMode="numeric" autoComplete="tel-national" required disabled={sent}/></div></label>
      {sent && <label>Enter OTP *<input type="text" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter 6-digit OTP" inputMode="numeric" autoComplete="one-time-code" required/></label>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <button type="button" className="btn primary full" disabled={busy||(!sent&&(!validPhone||(mode==="signup"&&!validName)))||(sent&&otp.length!==6)} onClick={sent?verify:send}>{busy?"Please wait...":sent?"Verify OTP":"Send OTP"}</button>
      {sent && <button type="button" className="btn outline full" disabled={busy} onClick={()=>{setSent(false);setOtp("");setMsg("");}}>Change Mobile Number</button>}
      <p className="auth-switch">{mode==="login" ? <>New student? <Link href={`/signup?next=${encodeURIComponent(destination())}`}>Create free account</Link></> : <>Already registered? <Link href={`/login?next=${encodeURIComponent(destination())}`}>Login here</Link></>}</p>
      <p className="muted">Your account is protected by mobile OTP verification.</p>
    </section>
  );
}
