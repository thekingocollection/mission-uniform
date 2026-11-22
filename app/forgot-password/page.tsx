"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase configuration is missing. Please contact support.");
      const { error: resetError } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "Unable to send reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mu-password-page">
      <section className="auth-card">
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h1>Forgot Password?</h1>
        <p>Enter your registered email. We will send a secure password reset link.</p>
        <form onSubmit={submit}>
          <label>Email Address
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </label>
          {message && <p className={error ? "notice" : "mu-auth-success"} role="status">{message}</p>}
          <button className="btn primary full" type="submit" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
        <p className="auth-switch"><Link href="/login">← Back to Login</Link></p>
      </section>
    </main>
  );
}
