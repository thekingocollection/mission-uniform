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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { id: testId } = await params;
    const body = await req.json();
    const attemptId = String(body.attempt_id || "");
    const answers = body.answers;

    if (!attemptId) return NextResponse.json({ error: "Test attempt ID is missing. Start the test again." }, { status: 400 });
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid answers submitted." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data, error } = await db.rpc("submit_test_attempt", {
      p_attempt_id: attemptId,
      p_test_id: testId,
      p_user_id: user.id,
      p_answers: answers
    });

    if (error) {
      const status = /already been submitted/i.test(error.message) ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("TEST_SUBMIT_ERROR:", error);
    return NextResponse.json({ error: error.message || "Unable to submit test." }, { status: 500 });
  }
}
