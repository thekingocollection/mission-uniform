"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function StudentPresenceTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastSent = 0;
    const send = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastSent < 12000) return;
      lastSent = now;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        const activeAttemptId = document.documentElement.dataset.muActiveAttempt || null;
        await fetch("/api/student-presence", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
          body: JSON.stringify({ current_path: pathname || "/", active_attempt_id: activeAttemptId })
        });
      } catch { /* Presence is best-effort and must never interrupt study. */ }
    };
    void send();
    timer = setInterval(() => void send(), 20000);
    const onVisibility = () => { if (document.visibilityState === "visible") { lastSent = 0; void send(); } };
    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    const { data: authListener } = sb.auth.onAuthStateChange(() => { lastSent = 0; void send(); });
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);
  return null;
}
