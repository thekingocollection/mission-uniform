"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminSupabaseBrowser } from "@/lib/admin-supabase-browser";
import { partnerSupabaseBrowser } from "@/lib/partner-supabase-browser";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const adminClient = adminSupabaseBrowser();
      if (!adminClient) throw new Error("Supabase environment variables are missing.");

      await adminClient.auth.signOut({ scope: "local" });
      const { data, error } = await adminClient.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error || !data.session?.access_token || !data.session.refresh_token) {
        throw new Error(error?.message || "Login failed. Please check your email and password.");
      }

      const accessToken = data.session.access_token;
      const refreshToken = data.session.refresh_token;

      const adminResponse = await fetch("/api/admin/session", {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store"
      });
      const adminResult = await adminResponse.json().catch(() => ({}));

      if (adminResponse.ok) {
        const requested = new URLSearchParams(window.location.search).get("next") || "/admin";
        const safeNext = requested.startsWith("/admin") && !requested.startsWith("/admin/login") ? requested : "/admin";
        router.replace(safeNext);
        router.refresh();
        return;
      }

      // The same authenticated Supabase token is checked for Partner access.
      // This avoids a second password sign-in and keeps Partner permissions separate.
      const partnerResponse = await fetch("/api/partner?verify=1", {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store"
      });
      const partnerResult = await partnerResponse.json().catch(() => ({}));

      if (partnerResponse.ok && partnerResult.partner?.status === "approved") {
        const partnerClient = partnerSupabaseBrowser();
        if (!partnerClient) throw new Error("Partner login service is unavailable. Please contact Admin.");

        const { error: partnerSessionError } = await partnerClient.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (partnerSessionError) throw new Error("Partner session could not be saved: " + partnerSessionError.message);

        await adminClient.auth.signOut({ scope: "local" });
        router.replace("/partner");
        router.refresh();
        return;
      }

      await adminClient.auth.signOut({ scope: "local" });
      const partnerError = partnerResult.error || (
        partnerResult.partner
          ? "Your Partner account is not approved yet. Please contact the Super Admin."
          : "No Partner account is linked to this email. Ask the Super Admin to create or approve your Partner account."
      );
      if (adminResponse.status >= 500) {
        throw new Error(adminResult.error || "Admin verification service is temporarily unavailable. Please try again.");
      }
      throw new Error(partnerError);
    } catch (error: any) {
      setMessage(error?.message || "Unable to sign in. Please retry.");
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(135deg,#eef3f9 0%,#f8fafc 55%,#f4f0e7 100%)" }}>
      <section style={{ width: "100%", maxWidth: 440, padding: 32, borderRadius: 22, border: "1px solid #dce4ee", background: "#fff", boxShadow: "0 22px 65px rgba(18,43,70,.12)" }}>
        <div style={{ width: 48, height: 5, borderRadius: 10, background: "#c69b45", marginBottom: 22 }} />
        <p style={{ margin: 0, color: "#a07832", fontSize: 11, fontWeight: 900, letterSpacing: 2.2 }}>MISSION UNIFORM OP</p>
        <h1 style={{ color: "#142d49", fontSize: 29, lineHeight: 1.2, margin: "10px 0 8px" }}>Secure Login</h1>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
          One secure login for Super Admin, authorized Staff and approved Partners. Your account role opens the correct workspace automatically.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 7, color: "#263b53", fontSize: 13, fontWeight: 750 }}>
            Email Address
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", border: "1px solid #cbd5e1", borderRadius: 11, outlineColor: "#c69b45", fontSize: 15 }}
            />
          </label>
          <label style={{ display: "grid", gap: 7, color: "#263b53", fontSize: 13, fontWeight: 750 }}>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", border: "1px solid #cbd5e1", borderRadius: 11, outlineColor: "#c69b45", fontSize: 15 }}
            />
          </label>

          {message && <p role="alert" style={{ margin: 0, padding: 12, borderRadius: 10, color: "#a32323", background: "#fff1f1", border: "1px solid #fecaca", fontSize: 13, lineHeight: 1.5 }}>{message}</p>}

          <button type="submit" disabled={busy} style={{ marginTop: 4, padding: 14, border: 0, borderRadius: 11, background: busy ? "#8292a5" : "#173b60", color: "#fff", fontWeight: 850, fontSize: 15, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Verifying Account…" : "Login to Workspace"}
          </button>
        </form>

        <div style={{ borderTop: "1px solid #e7edf3", marginTop: 23, paddingTop: 18, color: "#718096", fontSize: 12, lineHeight: 1.7 }}>
          Partner accounts created and approved in Partnership Management can use this same login. They will open the Partner Workspace automatically.
          <div style={{ marginTop: 12 }}><Link href="/partner/login" style={{ color: "#173b60", fontWeight: 800, textDecoration: "none" }}>Open Partner Login instead →</Link></div>
        </div>
      </section>
    </main>
  );
}
