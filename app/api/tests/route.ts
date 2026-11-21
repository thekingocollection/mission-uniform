import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

type QuestionInput = {
  question_hi: string;
  question_or?: string | null;
  question_en?: string | null;
  options: string[];
  correct_option: string;
  explanation_hi?: string | null;
  explanation_or?: string | null;
  explanation_en?: string | null;
  chapter?: string | null;
  difficulty?: string;
};

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase authentication configuration missing.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function validQuestions(value: unknown): value is QuestionInput[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 10000 &&
    value.every((q: any) =>
      typeof q?.question_hi === "string" && q.question_hi.trim().length > 0 &&
      Array.isArray(q.options) && q.options.length === 4 &&
      q.options.every((x: any) => typeof x === "string" && x.trim().length > 0) &&
      ["A", "B", "C", "D"].includes(String(q.correct_option || "").toUpperCase())
    );
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const db = getServiceSupabase();
    let q = db.from("test_papers")
      .select("id,title,description,test_type,subject_id,chapter,duration_minutes,total_questions,marks_per_question,negative_marking,status,created_at,question_mode,pool_id")
      .eq("status", "published").order("created_at", { ascending: false });
    if (type) q = q.eq("test_type", type);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tests: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to load tests." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let poolId: string | null = null;
  let testId: string | null = null;
  const db = getServiceSupabase();

  try {
    const user = await authUser(req);
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { data: profile, error: profileError } = await db
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError || profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const mode = String(body.question_mode || "bank");
    const desiredStatus = body.status === "published" ? "published" : "draft";
    const title = String(body.title || "").trim();
    const total = Number(body.total_questions);
    const minutes = Number(body.duration_minutes);
    const marks = Number(body.marks_per_question ?? 1);
    const negative = Number(body.negative_marking ?? 0);

    if (!title) return NextResponse.json({ error: "Test title is required." }, { status: 400 });
    if (!["bank", "manual", "pool"].includes(mode)) {
      return NextResponse.json({ error: "Invalid question mode." }, { status: 400 });
    }
    if (!Number.isInteger(total) || total < 1 || total > 300) {
      return NextResponse.json({ error: "Test question count must be between 1 and 300." }, { status: 400 });
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300 || !Number.isFinite(marks) || marks < 0 || !Number.isFinite(negative) || negative < 0) {
      return NextResponse.json({ error: "Check duration, marks and negative marking." }, { status: 400 });
    }

    const questionPayloads = body.question_payloads;
    const questionIds: string[] = Array.isArray(body.question_ids) ? body.question_ids : [];

    if (mode === "bank" && questionIds.length !== total) {
      return NextResponse.json({ error: "Selected Question Bank questions must match the test question count." }, { status: 400 });
    }
    if (mode === "manual" && (!validQuestions(questionPayloads) || questionPayloads.length !== total)) {
      return NextResponse.json({ error: "Manual upload questions must be valid and exactly match the test question count." }, { status: 400 });
    }
    if (mode === "pool" && (!validQuestions(questionPayloads) || questionPayloads.length < total)) {
      return NextResponse.json({ error: "Pool upload must contain at least the number of questions shown per test." }, { status: 400 });
    }

    if (mode === "pool") {
      const { data: pool, error } = await db.from("question_pools").insert({
        title: String(body.pool_title || title).trim(),
        description: body.pool_description || null,
        subject_id: body.subject_id || null,
        created_by: user.id
      }).select("id").single();
      if (error || !pool) throw new Error(error?.message || "Could not create question pool.");
      poolId = pool.id;
    }

    const paper = {
      title,
      description: body.description || null,
      test_type: body.test_type || "daily",
      subject_id: body.subject_id || null,
      chapter: body.chapter || null,
      duration_minutes: minutes,
      total_questions: total,
      marks_per_question: marks,
      negative_marking: negative,
      question_mode: mode,
      pool_id: poolId,
      status: "draft",
      created_by: user.id
    };

    const { data: test, error: testError } = await db.from("test_papers")
      .insert(paper).select("*").single();
    if (testError || !test) throw new Error(testError?.message || "Could not create test.");
    testId = test.id;

    if (mode === "bank") {
      const { data: valid, error } = await db.from("questions").select("id")
        .in("id", questionIds).eq("is_active", true).eq("verified", true);
      if (error || (valid?.length ?? 0) !== questionIds.length) {
        throw new Error(error?.message || "Only active and verified Question Bank questions can be selected.");
      }
      const rows = questionIds.map((question_id, i) => ({ test_id: testId, question_id, sort_order: i + 1 }));
      const { error: linkError } = await db.from("test_paper_questions").insert(rows);
      if (linkError) throw new Error(linkError.message);
    }

    if (mode === "manual") {
      const rows = questionPayloads.map((q, i) => ({
        test_id: testId,
        sort_order: i + 1,
        question_hi: q.question_hi.trim(),
        question_or: q.question_or || null,
        question_en: q.question_en || null,
        options: q.options,
        correct_option: q.correct_option.toUpperCase(),
        explanation_hi: q.explanation_hi || null,
        explanation_or: q.explanation_or || null,
        explanation_en: q.explanation_en || null,
        chapter: q.chapter || body.chapter || null,
        difficulty: q.difficulty || "medium"
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from("manual_test_questions").insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
    }

    if (mode === "pool") {
      const rows = questionPayloads.map((q, i) => ({
        pool_id: poolId,
        question_hi: q.question_hi.trim(),
        question_or: q.question_or || null,
        question_en: q.question_en || null,
        options: q.options,
        correct_option: q.correct_option.toUpperCase(),
        explanation_hi: q.explanation_hi || null,
        explanation_or: q.explanation_or || null,
        explanation_en: q.explanation_en || null,
        chapter: q.chapter || body.chapter || null,
        difficulty: q.difficulty || "medium",
        source_row: i + 1
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from("pool_questions").insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      const { count, error } = await db.from("pool_questions")
        .select("id", { count: "exact", head: true }).eq("pool_id", poolId);
      if (error || (count ?? 0) < total) throw new Error(error?.message || "Pool does not contain enough questions.");
    }

    if (desiredStatus === "published") {
      const { error } = await db.from("test_papers").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", testId);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true, test: { ...test, status: desiredStatus }, pool_id: poolId }, { status: 201 });
  } catch (error: any) {
    if (testId) await db.from("test_papers").delete().eq("id", testId);
    if (poolId) await db.from("question_pools").delete().eq("id", poolId);
    return NextResponse.json({ error: error.message || "Could not save test." }, { status: 400 });
  }
}
