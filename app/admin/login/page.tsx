"use client";

import { useState } from "react";
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const sb = adminSupabaseBrowser();
      if (!sb) throw new Error("Supabase environment variables are missing.");
      await sb.auth.signOut();
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (error || !data.session?.access_token) {
        throw new Error(error?.message || "Login failed. Please check your email and password.");
      }
      await sb.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });

      const verify = await fetch("/api/admin/session", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store"
      });
      const verified = await verify.json().catch(() => ({}));
      if (verify.ok) {
        const requested = new URLSearchParams(window.location.search).get("next") || "/admin";
        const safeNext = requested.startsWith("/admin") && !requested.startsWith("/admin/login") ? requested : "/admin";
        router.replace(safeNext);
        router.refresh();
        return;
      }

      // Partner accounts use the same Admin / Staff Login screen, but keep
      // their own isolated Supabase browser session and are routed to /partner.
      const partnerClient = partnerSupabaseBrowser();
      if (partnerClient) {
        await partnerClient.auth.signOut();
        const partnerLogin = await partnerClient.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });
        if (!partnerLogin.error && partnerLogin.data.session?.access_token) {
          const partnerVerify = await fetch("/api/partner", {
            headers: { Authorization: "Bearer " + partnerLogin.data.session.access_token },
            cache: "no-store"
          });
          const partnerData = await partnerVerify.json().catch(() => ({}));
          if (partnerVerify.ok && partnerData.partner) {
            await sb.auth.signOut();
            router.replace("/partner");
            router.refresh();
            return;
          }
          await partnerClient.auth.signOut();
        }
      }
      await sb.auth.signOut();
      throw new Error(verified.error || "This account is not assigned as Admin, Staff or an active Partner. Please contact the Super Admin.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to sign in. Please retry.");
      setBusy(false);
    }
  }
