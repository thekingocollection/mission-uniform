"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const links = [
  ["Overview", "/admin", "▦"], ["Students", "/admin/students", "♙"],
  ["Subjects", "/admin/subjects", "▤"], ["Chapters", "/admin/chapters", "▧"],
  ["Question Bank + Bulk", "/admin/questions", "✎"], ["Mock Tests", "/admin/tests", "◷"],
  ["Job Alerts", "/admin/job-alerts", "⌕"], ["Notifications", "/admin/notifications", "♧"],
  ["Website Settings", "/admin/settings", "⚙"],
];
export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const path = usePathname();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [state, setState] = useState<"checking"|"allowed"|"denied">("checking");
  const [email, setEmail] = useState("");
  useEffect(() => { let alive = true; (async () => {
    if (path === "/admin/login") return;
    if (!supabase) { if (alive) setState("denied"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/admin/login?next=" + encodeURIComponent(path)); return; }
    const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!alive) return;
    setEmail(user.email || "Super Admin");
    if (!error && profile?.role === "super_admin") setState("allowed");
    else setState("denied");
  })(); return () => { alive = false; }; }, [supabase, router, path]);
  async function logout() { await supabase?.auth.signOut(); router.replace("/admin/login"); }
  if (path === "/admin/login") return <>{children}</>;
  if (state === "checking") return <div className="admin-loading">Verifying secure Super Admin access…</div>;
  if (state === "denied") return <div className="admin-denied"><h1>Super Admin access required</h1><p>Your signed-in account does not have the <code>super_admin</code> role in the profiles table. Check the role for this account ID in Supabase.</p><Link href="/admin/login">Return to Admin Login</Link></div>;
  return <div className="admin-layout">
    <aside className="admin-sidebar"><Link href="/admin" className="admin-brand"><span className="admin-crest">MU</span><span><b>MISSION UNIFORM</b><small>SUPER ADMIN CONTROL</small></span></Link>
      <div className="admin-nav-label">WORKSPACE</div><nav>{links.map(([label, href, icon])=><Link key={href} href={href} className={path===href?"active":""}><i>{icon}</i>{label}</Link>)}</nav>
      <div className="admin-sidebar-bottom"><span>SECURE SESSION</span><small>{email}</small><button onClick={logout}>Sign out ↗</button><Link href="/">← View Website</Link></div>
    </aside>
    <section className="admin-main"><header className="admin-topbar"><div><small>MISSION UNIFORM OP / ADMINISTRATION</small><b>Control Centre</b></div><span className="admin-status"><i/> SUPER ADMIN</span></header><div className="admin-content">{children}</div></section>
  </div>;
}
