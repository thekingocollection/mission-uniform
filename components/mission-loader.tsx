"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MissionLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  useEffect(() => {
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      setLoading(true);
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => setLoading(false), 12000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (form && form.method.toLowerCase() !== "dialog") start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (stopTimer) clearTimeout(stopTimer);
    };
  }, []);

  if (!loading) return null;
  return (
    <div className="mu-mission-loader" role="status" aria-live="polite" aria-label="Mission in progress">
      <div className="mu-loader-card">
        <div className="mu-police-star-wrap" aria-hidden="true">
          <span className="mu-star-orbit mu-star-orbit-one" />
          <span className="mu-star-orbit mu-star-orbit-two" />
          <svg className="mu-police-star" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="muStarGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff0b5" />
                <stop offset="48%" stopColor="#e3b94f" />
                <stop offset="100%" stopColor="#a97720" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="53" fill="#102b40" stroke="url(#muStarGold)" strokeWidth="3" />
            <circle cx="60" cy="60" r="44" fill="none" stroke="#f6d98e" strokeWidth="1.5" strokeDasharray="3 4" />
            <path d="M60 10 L69 43 L101 29 L77 55 L110 67 L76 73 L91 106 L60 82 L29 106 L44 73 L10 67 L43 55 L19 29 L51 43 Z" fill="url(#muStarGold)" stroke="#fff0c2" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="60" cy="60" r="23" fill="#102b40" stroke="#fff0c2" strokeWidth="2" />
            <text x="60" y="66" textAnchor="middle" fill="#fff0c2" fontSize="17" fontWeight="900" letterSpacing="1">OP</text>
          </svg>
          <span className="mu-star-spark mu-star-spark-a">✦</span>
          <span className="mu-star-spark mu-star-spark-b">✧</span>
        </div>
        <span className="mu-loader-kicker">MISSION UNIFORM OP</span>
        <strong className="mu-loader-title">MISSION IN PROCESS</strong>
        <span className="mu-loader-subtitle">Preparing your next step...</span>
        <div className="mu-loader-progress"><i /></div>
      </div>
    </div>
  );
}
