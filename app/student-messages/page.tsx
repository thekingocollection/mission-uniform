"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Message = { id: string; title: string; body: string; created_at: string; read_at: string | null; is_broadcast: boolean };

export default function StudentMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const sb = supabaseBrowser();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) throw new Error("Please sign in.");
      const res = await fetch("/api/student/messages", { headers: { Authorization: "Bearer " + session.access_token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load messages.");
      setMessages(data.messages || []);
    } catch (e: any) { setError(e.message || "Could not load messages."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function markRead(id: string) {
    const sb = supabaseBrowser();
    const { data: { session } } = await sb!.auth.getSession();
    if (!session) return;
    await fetch("/api/student/messages", { method: "PATCH", headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" }, body: JSON.stringify({ message_id: id }) });
    setMessages(old => old.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
  }
  const unread = messages.filter(m => !m.read_at).length;
  return <main className="mx-auto w-full max-w-4xl px-4 py-8"><div className="mb-6"><p className="text-xs font-bold tracking-widest opacity-60">MISSION UNIFORM OP</p><h1 className="text-3xl font-bold">My Messages</h1><p className="mt-1 opacity-70">{unread} unread · {messages.length} total</p></div>
    {error && <p role="alert" className="mb-4 rounded-xl border p-3">{error}</p>}
    {loading ? <p>Loading messages…</p> : messages.length ? <div className="space-y-3">{messages.map(m=><article key={m.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{m.title}</h2><span className="text-xs opacity-60">{new Date(m.created_at).toLocaleString("en-IN")}</span></div><p className="mt-2 whitespace-pre-wrap">{m.body}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs opacity-60">{m.is_broadcast ? "Official announcement" : "Private message"}</span>{!m.read_at && <button className="rounded-lg border px-3 py-1 text-sm" onClick={()=>void markRead(m.id)}>Mark as read</button>}</div></article>)}</div> : <div className="rounded-2xl border p-8 text-center"><h2 className="font-semibold">No messages yet</h2><p className="mt-1 text-sm opacity-70">Admin announcements and personal messages will appear here.</p></div>}
  </main>;
}
