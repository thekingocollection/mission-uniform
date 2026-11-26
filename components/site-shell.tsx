"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SponsorBanner } from "@/components/sponsor-banner";

const links = [
  ["Home", "/", "⌂"],
  ["Mock Test", "/subject-mock-test", "✦"],
  ["Special Mock Test", "/tests", "✎"],
  ["Syllabus", "/syllabus", "▤"],
  ["Job Alerts", "/job-alerts", "◷"],
  ["Previous Year Questions", "/previous-papers", "▧"],
  ["Dashboard", "/dashboard", "▦"],
  ["Leaderboard", "/leaderboard", "♛"],
  ["Test History", "/test-history", "◷"],
  ["Notifications", "/notifications", "♧"],
  ["Feedback & Survey", "/feedback", "★"],
  ["My Profile", "/profile", "◎"],
  ["Support Centre", "/support", "✉"],
];

const publicPaths = ["/", "/login", "/signup", "/about", "/contact", "/privacy-policy", "/terms", "/forgot-password", "/reset-password"];
function isPublicPath(path: string) {
  return publicPaths.includes(path) || path.startsWith("/login/") || path.startsWith("/signup/");
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const refreshSession = async (session: any) => {
      setSignedIn(!!session?.user);
      if (!session?.access_token) { setUnreadNotifications(0); return; }
      try {
        const response = await fetch("/api/student/notifications", { headers: { Authorization: "Bearer " + session.access_token }, cache: "no-store" });
        if (response.ok) { const result = await response.json(); setUnreadNotifications(Number(result.unread_count || 0)); }
      } catch { /* Notification badge is best-effort. */ }
    };
    sb.auth.getSession().then(({ data }) => void refreshSession(data.session));
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => void refreshSession(session));
    return () => listener.subscription.unsubscribe();
  }, [path]);

  async function logout() {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    setSignedIn(false);
    setOpen(false);
    window.location.replace("/");
  }

  return (
    <header className={open ? "site-header mu-nav-open" : "site-header"}>
      <Link className="brand" href="/" onClick={() => setOpen(false)}>
        <span>MISSION <b>UNIFORM OP</b><small>आपकी वर्दी, आपका सपना।</small></span>
      </Link>
      <button className={open ? "menu-toggle is-open" : "menu-toggle"} onClick={() => setOpen(v => !v)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mu-primary-navigation">
        {open ? <><span className="mu-menu-back" aria-hidden="true">←</span><span className="mu-menu-label">BACK</span></> : <><span className="mu-menu-lines" aria-hidden="true"><i /><i /><i /></span><span className="mu-menu-label">MENU</span></>}
      </button>
      <span className="mu-menu-coach" aria-hidden="true"><i>↗</i><b>HOW TO USE? TAP THESE 3 LINES ☰</b></span>
      <nav id="mu-primary-navigation" className={open ? "nav open" : "nav"} aria-label="Main navigation">
        {links.map(([name, href, icon]) => {
          const target = name === "Home" && signedIn ? "/dashboard" : href;
          const label = name === "Home" && signedIn ? "My Home" : name;
          return (
            <Link key={href} href={target} className={path === target || (target !== "/" && path.startsWith(target + "/")) ? "active" : ""} aria-current={path === target ? "page" : undefined} onClick={() => setOpen(false)}>
              <span className="nav-icon">{icon}</span>{label}{name === "Notifications" && unreadNotifications > 0 && <span className="mu-nav-unread">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
            </Link>
          );
        })}
        <a href="https://t.me/missionuniformm" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
          <span className="nav-icon">◉</span>Join Telegram Channel ↗
        </a>
        {signedIn ? (
          <>
            
            <button type="button" className="nav-login" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link className="nav-login" href={`/login?next=${encodeURIComponent(path)}`} onClick={() => setOpen(false)}>Login</Link>
            <Link className="nav-register" href={`/signup?next=${encodeURIComponent(path)}`} onClick={() => setOpen(false)}>Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}


function IndiaLiveClock() {
  const [now, setNow] = useState(() => new Date("2026-11-26T12:20:00+05:30"));
  useEffect(() => {
    const startedAt = Date.now();
    const base = new Date("2026-11-26T12:20:00+05:30").getTime();
    const update = () => setNow(new Date(base + (Date.now() - startedAt)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const dateText = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(now);
  const timeText = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  }).format(now);
  return <div className="mu-ist-clock" aria-label="India Standard Time">
    <span>{dateText}</span><b>{timeText}</b><small>IST · Asia/Kolkata</small>
  </div>;
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div><b>MISSION UNIFORM OP</b><p>Odisha Police & Government Exam Preparation</p></div>
      <div className="footer-links">
        <Link href="/about">About</Link><Link href="/contact">Contact</Link>
        <Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link>
        <a href="https://t.me/missionuniformm" target="_blank" rel="noopener noreferrer">Join Telegram Channel ↗</a>
      </div>
      <div className="mu-footer-bottom"><IndiaLiveClock /><small>© 2026 Mission Uniform OP. Educational platform.</small></div>
    </footer>
  );
}

function StudentAccessGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isPublicPath(path) || path.startsWith("/admin") || path.startsWith("/partner")) {
      setAllowed(true);
      setChecking(false);
      return;
    }
    let active = true;
    const sb = supabaseBrowser();
    if (!sb) {
      router.replace("/login?next=" + encodeURIComponent(path));
      return;
    }
    sb.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (!error && data.user) {
        setAllowed(true);
        setChecking(false);
      } else {
        router.replace("/login?next=" + encodeURIComponent(path));
      }
    });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setAllowed(true);
        setChecking(false);
      } else if (!isPublicPath(path) && !path.startsWith("/admin")) {
        setAllowed(false);
        router.replace("/login?next=" + encodeURIComponent(path));
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [path, router]);

  if (isPublicPath(path) || path.startsWith("/admin") || path.startsWith("/partner")) return <>{children}</>;
  if (checking || !allowed) return <main className="mu-access-welcome">
    <section className="mu-access-card">
      <span className="mu-access-kicker">MISSION UNIFORM OP · CADET ENTRY GATE</span>
      <p className="mu-access-overline">YOUR DREAM. YOUR UNIFORM. YOUR MISSION.</p>
      <h1>{checking ? "Preparing Your Student Portal" : "Your Mission Starts Here"}</h1>
      <p className="mu-access-lead">{checking ? "We are securely checking your student session. Please wait a moment." : "Login to continue your preparation, attempt mock tests and track your progress."}</p>
      <div className="mu-access-features">
        <span><b>01</b> Odisha Police Mock Tests</span>
        <span><b>02</b> Subject-wise Mock Test Practice</span>
        <span><b>03</b> Syllabus & Previous Papers</span>
        <span><b>04</b> Job Alerts & Progress</span>
      </div>
      {!checking && <div className="mu-access-actions">
        <a href={"/login?next=" + encodeURIComponent(path)}>STUDENT LOGIN <span>→</span></a>
        <a href={"/signup?next=" + encodeURIComponent(path)}>CREATE FREE ACCOUNT <span>↗</span></a>
      </div>}
      <small className="mu-access-foot">{checking ? "SECURE STUDENT ACCESS · PLEASE WAIT" : "FREE STUDENT REGISTRATION · START PREPARING TODAY"}</small>
    </section>
  </main>;
  return <>{children}</>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  return <><SiteHeader /><main className="main-wrap"><SponsorBanner placement={path.startsWith("/syllabus") ? "syllabus_top" : "global_top"} /><StudentAccessGate>{children}</StudentAccessGate><SponsorBanner placement="below_content" /></main><SiteFooter /></>;
}
