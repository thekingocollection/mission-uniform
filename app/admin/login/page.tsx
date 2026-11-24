"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Supabase environment variables are missing.");
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (error || !data.session?.access_token) {
        throw new Error(error?.message || "Login failed. Please check your email and password.");
      }
      const verify = await fetch("/api/admin/session", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store"
      });
      const verified = await verify.json().catch(() => ({}));
      if (!verify.ok) throw new Error(verified.error || "Administrator verification failed. Please contact the Super Admin.");
      const requested = new URLSearchParams(window.location.search).get("next") || "/admin";
      const safeNext = requested.startsWith("/admin") && !requested.startsWith("/admin/login") ? requested : "/admin";
      router.replace(safeNext);
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Unable to sign in. Please retry.");
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-mark">MU</div>
        <span className="admin-kicker">RESTRICTED ADMINISTRATOR ACCESS</span>
        <h1>Admin / Staff Login</h1>
        <p>Separate secure login for Super Admin and authorized staff accounts.</p>
        <form onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>
          {message && <div className="admin-alert" role="alert">{message}</div>}
          <button className="admin-primary" disabled={busy}>{busy ? "Verifying…" : "Secure Sign In →"}</button>
        </form>
        <Link href="/forgot-password">Forgot password?</Link>
        <small>Admin access is granted by the Super Admin. Student login remains separate.</small>
        <Link href="/login">← Student Login</Link>
      </div>
    </main>
  );
}
