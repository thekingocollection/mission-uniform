"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function MissionLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

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
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
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
    <div className="mu-mission-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="mu-loader-track">
        <span className="mu-loader-flash" />
        <span className="mu-loader-projectile" />
      </div>
      <span className="mu-loader-caption">MISSION IN PROGRESS</span>
    </div>
  );
}
