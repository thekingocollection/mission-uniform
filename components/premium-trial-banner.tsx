"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

export default function PremiumTrialBanner({ compact = false }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let active = true;
    const load = async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!active || !user) return;
      setSignedIn(true);
      const expiresAt = new Date(user.created_at).getTime() + 24 * 60 * 60 * 1000;
      const update = () => setRemaining(Math.max(0, expiresAt - Date.now()));
      update();
      timer = setInterval(update, 1000);
    };
    void load();
    return () => { active = false; if (timer) clearInterval(timer); };
  }, []);

  const ended = signedIn && remaining !== null && remaining <= 0;
  const countdown = remaining === null ? "24:00:00" : formatRemaining(remaining);

  return (
    <section className={compact ? "mu-trial-banner mu-trial-banner--compact" : "mu-trial-banner"} aria-label="New student free trial">
      <div className="mu-trial-copy">
        <span className="mu-trial-kicker"><i /> {ended ? "TRIAL COMPLETED" : "NEW STUDENT BENEFIT"}</span>
        <h2>{ended ? "YOUR FREE TRIAL HAS ENDED" : "24 HOURS OF FREE PREMIUM ACCESS"}</h2>
        <p>{ended
          ? "Your free access is over. Unlock Premium subjects to continue your preparation."
          : "Your personal 24-hour countdown starts when your student account is created. After it ends, Premium access is required for locked subjects."}</p>
        <div className="mu-trial-perks"><span>✦ All subjects during trial</span><span>✦ Purchased access stays active</span><span>✦ Secure Razorpay checkout</span></div>
      </div>
      <div className="mu-trial-clock" aria-live="off" aria-label={ended ? "Trial ended" : "Time remaining"}>
        <span>{ended ? "TRIAL ENDED" : "TIME LEFT"}</span><strong>{countdown}</strong><small>HRS&nbsp;&nbsp; MIN&nbsp;&nbsp; SEC</small>
      </div>
      <div className="mu-trial-actions"><small>{signedIn ? "Countdown is linked to your account registration time." : "Your personal 24-hour trial starts automatically after registration."}</small></div>
    </section>
  );
}
