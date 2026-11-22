"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) {
      setMessage("Supabase configuration is missing. Please contact support.");
      setChecking(false);
      return;
    }
    let active = true;
    const checkSession = async () => {
      const { data, error } = await sb.auth.getSession();
      if (!active) return;
      if (data.session) {
        setReady(true);
        setMessage("");
      } else if (error) {
        setMessage(error.message);
      }
      setChecking(false);
    };
    void checkSession();
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setReady(true);
        setMessage("");
        setChecking(false);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    const sb = supabaseBrowser();
    if (!sb) {
      setMessage("Supabase configuration is missing.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setMessage("Password updated successfully. You can now login with your new password.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password update failed. Request a new reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mu-password-page">
      <section className="auth-card">
        <span className="eyebrow">SECURE ACCOUNT RECOVERY</span>
        <h1>Set New Password</h1>
        <p>Choose a strong password with at least 8 characters.</p>
        {done ? (
          <>
            <p className="mu-auth-success" role="status">{message}</p>
            <Link className="btn primary full" href="/login">Go to Login</Link>
          </>
        ) : checking ? (
          <p role="status">Verifying your secure reset link…</p>
        ) : ready ? (
          <form onSubmit={submit}>
            <label>New Password
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            <label>Confirm New Password
              <input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            {message && <p className="notice" role="status">{message}</p>}
            <button className="btn primary full" type="submit" disabled={busy || password.length < 8 || confirm.length < 8}>
              {busy ? "Updating…" : "Update Password"}
            </button>
          </form>
        ) : (
          <>
            <p className="notice" role="status">{message || "This reset link is invalid or expired. Request a new reset link."}</p>
            <Link className="btn primary full" href="/forgot-password">Request New Reset Link</Link>
          </>
        )}
        <p className="auth-switch"><Link href="/login">← Back to Login</Link></p>
      </section>
    </main>
  );
}
