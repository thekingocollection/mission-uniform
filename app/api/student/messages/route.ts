import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const { data, error } = await db.from("student_messages").select("id,title,body,created_at,read_at,is_broadcast")
      .or(`user_id.eq.${authData.user.id},is_broadcast.eq.true`).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ messages: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not load messages." }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    const { message_id } = await req.json();
    if (!message_id) return NextResponse.json({ error: "Message ID required." }, { status: 400 });
    const { error } = await db.from("student_messages").update({ read_at: new Date().toISOString() })
      .eq("id", message_id).or(`user_id.eq.${authData.user.id},is_broadcast.eq.true`);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Could not update message." }, { status: 500 }); }
}
