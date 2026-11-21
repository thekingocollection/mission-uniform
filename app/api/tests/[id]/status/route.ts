import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { id } = await params;
    const { status } = await req.json();
    if (!["draft", "published", "archived"].includes(status)) {
      return NextResponse.json({ error: "Invalid test status." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const { data: test, error: testError } = await db.from("test_papers")
      .select("id,question_mode,pool_id,total_questions")
      .eq("id", id).maybeSingle();
    if (testError || !test) return NextResponse.json({ error: "Test not found." }, { status: 404 });

    if (status === "published") {
      let available = 0;
      if (test.question_mode === "pool") {
        const { count, error } = await db.from("pool_questions")
          .select("id", { count: "exact", head: true }).eq("pool_id", test.pool_id);
        if (error) throw error;
        available = count ?? 0;
      } else if (test.question_mode === "manual") {
        const { count, error } = await db.from("manual_test_questions")
          .select("id", { count: "exact", head: true }).eq("test_id", id);
        if (error) throw error;
        available = count ?? 0;
      } else {
        const { count, error } = await db.from("test_paper_questions")
          .select("id", { count: "exact", head: true }).eq("test_id", id);
        if (error) throw error;
        available = count ?? 0;
      }
      if (available < test.total_questions) {
        return NextResponse.json({
          error: `Test has only ${available} questions, but ${test.total_questions} are required.`
        }, { status: 400 });
      }
    }

    const { error } = await db.from("test_papers")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Status update failed." }, { status: 500 });
  }
}
