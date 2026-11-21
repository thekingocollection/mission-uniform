import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getServiceSupabase();

    const { data: test, error } = await db
      .from("test_papers")
      .select(
        "id,title,description,test_type,duration_minutes,total_questions,marks_per_question,negative_marking,status"
      )
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error || !test) {
      return NextResponse.json(
        { error: "Test not found or not published." },
        { status: 404 }
      );
    }

    const { data: links, error: linkError } = await db
      .from("test_paper_questions")
      .select(`
        sort_order,
        questions (
          id,
          question_hi,
          question_or,
          question_en,
          options,
          chapter,
          difficulty
        )
      `)
      .eq("test_id", id)
      .order("sort_order");

    if (linkError) {
      return NextResponse.json(
        { error: linkError.message },
        { status: 500 }
      );
    }

    const questions = (links ?? [])
      .map((item: any) => item.questions)
      .filter(Boolean);

    return NextResponse.json({ test, questions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to load test." },
      { status: 500 }
    );
  }
}

import { createClient } from "@supabase/supabase-js";

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const auth = createClient(url, key);
  const { data } = await auth.auth.getUser(token);
  return data.user ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const attemptId = String(body.attempt_id || "");
    const answers = body.answers;
    if (!attemptId || !answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid attempt or answers." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const { data: attempt, error: attemptError } = await db.from("test_attempts")
      .select("id,user_id,test_id,is_submitted,started_at")
      .eq("id", attemptId).eq("user_id", user.id).eq("test_id", id).maybeSingle();
    if (attemptError || !attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    if (attempt.is_submitted) return NextResponse.json({ error: "This test attempt has already been submitted." }, { status: 409 });

    const { data: rows, error: rowsError } = await db.from("test_attempt_questions")
      .select("sort_order,question_snapshot").eq("attempt_id", attemptId).order("sort_order");
    if (rowsError) throw new Error(rowsError.message);
    if (!rows?.length) throw new Error("No saved question snapshot found.");

    const { data: test, error: testError } = await db.from("test_papers")
      .select("marks_per_question,negative_marking").eq("id", id).single();
    if (testError) throw new Error(testError.message);

    const marks = Number(test.marks_per_question ?? 1);
    const negative = Number(test.negative_marking ?? 0);
    let correct = 0, wrong = 0, skipped = 0, score = 0;
    const review = rows.map((row: any) => {
      const q = row.question_snapshot || {};
      const selectedValue = answers[q.id];
      const selected = selectedValue === undefined || selectedValue === null ? null : Number(selectedValue);
      const valid = selected !== null && Number.isInteger(selected) && selected >= 0 && selected <= 3;
      const answerLetter = String(q.correct_option || "").trim().toUpperCase();
      const answerIndex = ["A", "B", "C", "D"].indexOf(answerLetter);
      let status: "correct" | "wrong" | "skipped";
      if (!valid) { status = "skipped"; skipped++; }
      else if (selected === answerIndex) { status = "correct"; correct++; score += marks; }
      else { status = "wrong"; wrong++; score -= negative; }

      let options: string[] = [];
      if (Array.isArray(q.options)) options = q.options.map((o: any) => typeof o === "string" ? o : String(o?.text ?? o?.value ?? ""));
      else if (q.options && typeof q.options === "object") options = ["A","B","C","D"].map(k => String(q.options[k] ?? ""));
      return {
        id: q.id, question: q.question_hi || q.question_or || q.question_en || "",
        options, selected, correct_option: answerLetter,
        explanation: q.explanation || "", status
      };
    });

    score = Number(score.toFixed(2));
    const total = rows.length;
    const accuracy = Number(((correct / total) * 100).toFixed(2));
    const submittedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await db.from("test_attempts").update({
      answers, score, correct_count: correct, wrong_count: wrong,
      skipped_count: skipped, total_questions: total, submitted_at: submittedAt,
      is_submitted: true
    }).eq("id", attemptId).eq("user_id", user.id).eq("is_submitted", false)
      .select("*").maybeSingle();
    if (saveError) throw new Error("Result save failed: " + saveError.message);
    if (!saved) return NextResponse.json({ error: "Attempt was already submitted." }, { status: 409 });
    return NextResponse.json({ success: true, attempt: saved, total, accuracy, review });
  } catch (error: any) {
    console.error("TEST_SUBMIT_ERROR:", error);
    return NextResponse.json({ error: error.message || "Unable to submit test." }, { status: 500 });
  }
}
