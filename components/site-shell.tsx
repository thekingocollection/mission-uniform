"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["Home", "/", "⌂"],
  ["Mock Tests", "/tests", "✎"],
  ["Syllabus", "/syllabus", "▤"],
  ["Job Alerts", "/job-alerts", "◷"],
  ["Previous Papers", "/previous-papers", "▧"],
  ["Dashboard", "/dashboard", "▦"],
  ["Leaderboard", "/leaderboard", "♛"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
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
        {links.map(([name, href, icon]) => (
          <Link key={href} href={href} className={path === href ? "active" : ""} onClick={() => setOpen(false)}>
            <span className="nav-icon">{icon}</span>{name}
          </Link>
        ))}
        <Link href="/profile" onClick={() => setOpen(false)}>Profile</Link>
        <Link className="nav-login" href="/login" onClick={() => setOpen(false)}>Login</Link>
        <Link className="nav-register" href="/signup" onClick={() => setOpen(false)}>Register</Link>
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

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  return <><SiteHeader /><main className="main-wrap">{children}</main><SiteFooter /></>;
}
