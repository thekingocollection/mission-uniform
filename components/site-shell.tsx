"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const links = [
  ["Home", "/", "⌂"],
  ["Special Mock Test", "/tests", "✎"],
  ["Mock Test", "/subject-mock-test", "✦"],
  ["Syllabus", "/syllabus", "▤"],
  ["Job Alerts", "/job-alerts", "◷"],
  ["Previous Year Questions", "/previous-papers", "▧"],
  ["Dashboard", "/dashboard", "▦"],
  ["Leaderboard", "/leaderboard", "♛"],
];

const publicPaths = ["/", "/login", "/signup", "/about", "/contact", "/privacy-policy", "/terms"];
function isPublicPath(path: string) {
  return publicPaths.includes(path) || path.startsWith("/login/") || path.startsWith("/signup/");
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => setSignedIn(!!session?.user));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    const sb = supabaseBrowser();
    if (sb) await sb.auth.signOut();
    setSignedIn(false);
    setOpen(false);
    window.location.replace("/");
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/" onClick={() => setOpen(false)}>
        <span className="brand-mark">MU</span>
        <span>MISSION <b>UNIFORM OP</b><small>आपकी वर्दी, आपका सपना।</small></span>
      </Link>
      <button className="menu-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation" aria-expanded={open}>
        {open ? "✕" : "☰"}
      </button>
      <nav className={open ? "nav open" : "nav"}>
        {links.map(([name, href, icon]) => {
          const target = name === "Home" && signedIn ? "/dashboard" : href;
          const label = name === "Home" && signedIn ? "My Home" : name;
          return (
            <Link key={href} href={target} className={path === target ? "active" : ""} onClick={() => setOpen(false)}>
              <span className="nav-icon">{icon}</span>{label}
            </Link>
          );
        })}
        {signedIn ? (
          <>
            <Link href="/profile" onClick={() => setOpen(false)}>My Profile</Link>
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

export function SiteFooter() {
  return (
    <footer className="footer">
      <div><b>MISSION UNIFORM OP</b><p>Odisha Police & Government Exam Preparation</p></div>
      <div className="footer-links">
        <Link href="/about">About</Link><Link href="/contact">Contact</Link>
        <Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link>
      </div>
      <small>© {new Date().getFullYear()} Mission Uniform OP. Educational platform.</small>
    </footer>
  );
}

function StudentAccessGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isPublicPath(path) || path.startsWith("/admin")) {
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

  if (isPublicPath(path) || path.startsWith("/admin")) return <>{children}</>;
  if (checking || !allowed) return <main className="mu-access-welcome">
    <section className="mu-access-card">
      <span className="mu-access-kicker">MISSION UNIFORM OP · CADET ENTRY GATE</span>
      <div className="mu-access-emblem" aria-hidden="true">MU<span>★</span></div>
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
  return <><SiteHeader /><main className="main-wrap"><StudentAccessGate>{children}</StudentAccessGate></main><SiteFooter /></>;
}
