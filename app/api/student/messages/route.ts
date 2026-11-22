import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function signedIn(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  return error ? null : data.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await signedIn(req);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: messages, error } = await db.from("student_messages")
      .select("id,title,body,created_at,read_at,is_broadcast")
      .or(`user_id.eq.${user.id},is_broadcast.eq.true`)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const broadcastIds = (messages || []).filter((m: any) => m.is_broadcast).map((m: any) => m.id);
    const { data: reads, error: readError } = broadcastIds.length
      ? await db.from("student_message_reads").select("message_id,read_at").eq("user_id", user.id).in("message_id", broadcastIds)
      : { data: [], error: null };
    if (readError) throw readError;
    const readMap = new Map((reads || []).map((r: any) => [r.message_id, r.read_at]));
    return NextResponse.json({
      messages: (messages || []).map((m: any) => ({ ...m, read_at: m.is_broadcast ? readMap.get(m.id) || null : m.read_at }))
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load messages." }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await signedIn(req);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { message_id } = await req.json();
    if (!message_id) return NextResponse.json({ error: "Message ID required." }, { status: 400 });
    const { data: message, error: findError } = await db.from("student_messages")
      .select("id,is_broadcast,user_id").eq("id", message_id).maybeSingle();
    if (findError) throw findError;
    if (!message || (!message.is_broadcast && message.user_id !== user.id)) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (message.is_broadcast) {
      const { error } = await db.from("student_message_reads").upsert({ message_id, user_id: user.id, read_at: new Date().toISOString() }, { onConflict: "message_id,user_id" });
      if (error) throw error;
    } else {
      const { error } = await db.from("student_messages").update({ read_at: new Date().toISOString() }).eq("id", message_id).eq("user_id", user.id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not update message." }, { status: 500 }); }
}
