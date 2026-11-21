"use client";
import Link from "next/link"; import {usePathname} from "next/navigation"; import {useState} from "react";
import { NativeAppBridge } from "@/components/native-app-bridge";
const links = [
  ["Home", "/"],
  ["Previous Papers", "/previous-papers"],
  ["Job Alerts", "/job-alerts"],
  ["Leaderboard", "/leaderboard"],
  ["About", "/about"],
];
export function SiteHeader(){const [open,setOpen]=useState(false); const path=usePathname(); return <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">MU</span><span>MISSION <b>UNIFORM OP</b><small>आपकी वर्दी, आपका सपना।</small></span></Link><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-label="Toggle menu">☰</button><nav className={open?'nav open':'nav'}>{links.map(([n,u])=><Link key={u} className={path===u?'active':''} onClick={()=>setOpen(false)} href={u}>{n}</Link>)}<Link href="/dashboard">Dashboard</Link><Link className="nav-login" href="/login">
  Student Login
</Link>

<Link className="nav-register" href="/signup">
  Student Registration
</Link></nav></header> }
export function SiteFooter(){return <footer className="footer"><div><b>MISSION UNIFORM OP</b><p>Free exam preparation for every learner.</p></div><div className="footer-links"><Link href="/contact">Contact</Link><Link href="/privacy-policy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/admin">Admin</Link></div><small>© {new Date().getFullYear()} Mission Uniform OP. Educational platform.</small></footer>}
export function Shell({children}:{children:React.ReactNode}){const path=usePathname();if(path.startsWith("/admin"))return <>{children}</>;return <><SiteHeader/><main className="main-wrap">{children}</main><SiteFooter/></>}
