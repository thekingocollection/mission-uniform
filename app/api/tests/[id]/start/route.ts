import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const auth = createClient(url, key);
  const { data } = await auth.auth.getUser(token);
  return data.user ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const { id } = await params;
    const db = getServiceSupabase();
    const { data: test, error: testError } = await db.from("test_papers")
      .select("id,title,description,test_type,question_mode,pool_id,subject_id,chapter,duration_minutes,total_questions,marks_per_question,negative_marking,status")
      .eq("id", id).eq("status", "published").maybeSingle();
    if (testError || !test) return NextResponse.json({ error: "Test not found or not published." }, { status: 404 });

    let questions: any[] = [];
    const source = test.question_mode === "pool" ? "pool" : "manual";
    if (source === "pool") {
      if (!test.pool_id) return NextResponse.json({ error: "Question pool is not configured." }, { status: 400 });
      const { data: picked, error } = await db.rpc("pick_student_pool_questions", {
        p_user_id: user.id, p_pool_id: test.pool_id, p_limit: Number(test.total_questions)
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      questions = (picked?.questions ?? []).map((q: any) => ({
        id: q.id, question_hi: q.question_hi, question_or: q.question_or, question_en: q.question_en,
        options: q.options, chapter: q.chapter, difficulty: q.difficulty,
        correct_option: q.correct_option, explanation: q.explanation
      }));
    } else {
      const { data: links, error } = await db.from("test_paper_questions")
        .select("sort_order,questions(id,question_hi,question_or,question_en,options,chapter,difficulty,correct_option,explanation)")
        .eq("test_id", id).order("sort_order");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      questions = (links ?? []).map((x: any) => x.questions).filter(Boolean);
    }
    if (!questions.length) return NextResponse.json({ error: "No questions configured for this test." }, { status: 400 });
    if (questions.length !== Number(test.total_questions) && source === "pool") {
      return NextResponse.json({ error: "Pool returned an unexpected question count." }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { data: attempt, error: attemptError } = await db.from("test_attempts").insert({
      user_id: user.id, test_id: id, answers: {}, score: 0,
      correct_count: 0, wrong_count: 0, skipped_count: questions.length,
      total_questions: questions.length, started_at: now, submitted_at: now
    }).select("id,started_at").single();
    if (attemptError) return NextResponse.json({ error: "Could not start attempt: " + attemptError.message }, { status: 500 });

    const snapshots = questions.map((q: any, i: number) => ({
      attempt_id: attempt.id, question_source: source,
      question_id: source === "manual" ? q.id : null,
      pool_question_id: source === "pool" ? q.id : null,
      sort_order: i + 1,
      question_snapshot: {
        id: q.id, question_hi: q.question_hi, question_or: q.question_or, question_en: q.question_en,
        options: q.options, chapter: q.chapter, difficulty: q.difficulty,
        correct_option: q.correct_option, explanation: q.explanation ?? ""
      }
    }));
    const { error: snapshotError } = await db.from("test_attempt_questions").insert(snapshots);
    if (snapshotError) {
      await db.from("test_attempts").delete().eq("id", attempt.id);
      return NextResponse.json({ error: "Could not save question snapshot: " + snapshotError.message }, { status: 500 });
    }

    const safeQuestions = questions.map((q: any) => ({
      id: q.id, question_hi: q.question_hi, question_or: q.question_or, question_en: q.question_en,
      options: q.options, chapter: q.chapter, difficulty: q.difficulty
    }));
    return NextResponse.json({ test, attempt_id: attempt.id, started_at: attempt.started_at, questions: safeQuestions });
  } catch (error: any) {
    console.error("TEST_START_ERROR", error);
    return NextResponse.json({ error: error.message || "Unable to start test." }, { status: 500 });
  }
}
