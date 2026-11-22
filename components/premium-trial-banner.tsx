"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// One shared launch deadline for every visitor. This is not a per-account timer.
const TRIAL_ENDS_AT = Date.parse("2026-11-23T05:30:40.000Z");

function format(value: number) {
  return String(value).padStart(2, "0");
}

export default function PremiumTrialBanner({ compact = false }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, TRIAL_ENDS_AT - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalSeconds = remaining === null ? null : Math.floor(remaining / 1000);
  const hours = totalSeconds === null ? "--" : format(Math.floor(totalSeconds / 3600));
  const minutes = totalSeconds === null ? "--" : format(Math.floor((totalSeconds % 3600) / 60));
  const seconds = totalSeconds === null ? "--" : format(totalSeconds % 60);
  const ended = remaining !== null && remaining <= 0;

  return (
    <section className={compact ? "mu-trial-banner mu-trial-banner--compact" : "mu-trial-banner"} aria-label="24-hour Premium launch offer">
      <div className="mu-trial-copy">
        <span className="mu-trial-kicker"><i /> LIMITED-TIME LAUNCH ACCESS</span>
        <h2>{ended ? "The 24-hour Premium offer has ended" : "24 HOURS OF PREMIUM. ON US."}</h2>
        <p>{ended
          ? "The launch offer window is now closed. Choose a plan to continue with Premium features."
          : "Explore the MISSION UNIFORM OP Premium experience during this one-time launch window. The same deadline applies to every visitor."}</p>
        {!ended && <div className="mu-trial-perks"><span>✦ Extra Mock Tests</span><span>✦ Detailed Solutions</span><span>✦ Advanced Practice</span></div>}
        {ended && <div className="mu-trial-perks"><span>₹49 / 90 Days</span><span>₹99 / 180 Days</span></div>}
      </div>
      <div className="mu-trial-clock" aria-live="off">
        <span>{ended ? "OFFER CLOSED" : "TIME REMAINING"}</span>
        <strong>{hours}<i>:</i>{minutes}<i>:</i>{seconds}</strong>
        <small>HRS&nbsp;&nbsp; MIN&nbsp;&nbsp; SEC</small>
      </div>
      <div className="mu-trial-actions">
        {ended ? (
          <Link href="/signup" className="mu-trial-cta">VIEW PREMIUM PLANS <b>↗</b></Link>
        ) : (
          <Link href="/signup" className="mu-trial-cta">START FREE PREPARATION <b>↗</b></Link>
        )}
        <small>Core free tests, syllabus and job alerts remain free.</small>
      </div>
    </section>
  );
}
