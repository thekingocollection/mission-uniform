"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
export default function AdminLogin(){
 const router=useRouter(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");const sb=supabaseBrowser();if(!sb){setMessage("Supabase environment variables are missing.");setBusy(false);return;}
 const {data,error}=await sb.auth.signInWithPassword({email:email.trim(),password});if(error){setMessage(error.message);setBusy(false);return;}
 const {data:profile,error:profileError}=await sb.from("profiles").select("role,is_blocked").eq("id",data.user.id).maybeSingle();
 if(profileError||profile?.role!=="super_admin"||profile?.is_blocked){await sb.auth.signOut();setMessage("Access denied. This account is not an active Super Admin.");setBusy(false);return;}
 const requested = new URLSearchParams(window.location.search).get("next") || "/admin";
 const destination = requested.startsWith("/admin") && !requested.startsWith("/admin/login") ? requested : "/admin";
 router.replace(destination);router.refresh();
 }
 return <main className="admin-login-page"><div className="admin-login-card"><div className="admin-login-mark">MU</div><span className="admin-kicker">RESTRICTED ADMINISTRATOR ACCESS</span><h1>Super Admin Login</h1><p>Sign in with the dedicated administrator email and password.</p><form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your admin password"/></label>{message&&<div className="admin-alert">{message}</div>}<button className="admin-primary" disabled={busy}>{busy?"Verifying…":"Secure Sign In →"}</button></form><a href="/login">Student Login</a><small>Access is granted only when the Supabase profile role is <b>super_admin</b>.</small></div></main>
}
