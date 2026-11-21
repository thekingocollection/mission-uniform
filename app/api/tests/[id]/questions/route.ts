import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Please login to access this test." }, { status: 401 });
  }
  const token = authorization.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) return NextResponse.json({ error: "Supabase public configuration is missing." }, { status: 500 });
  const authClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: "Please login to access this test." }, { status: 401 });

  const { id } = await params;
  const db = getServiceSupabase();
  const { data: test, error } = await db.from("test_papers")
    .select("id,title,description,test_type,question_mode,duration_minutes,total_questions,marks_per_question,negative_marking,status,is_previous_year,exam_year,exam_name,session_label,source_label")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (error || !test) return NextResponse.json({ error: "Test not found or not published." }, { status: 404 });
  if (test.question_mode === "pool" || test.question_mode === "subject_random") return NextResponse.json({ test, questions: [] });
  const { data: links, error: linkError } = await db.from("test_paper_questions")
    .select("sort_order,questions(id,question_hi,question_or,question_en,options,chapter,difficulty)")
    .eq("test_id", id).order("sort_order");
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  const questions = (links ?? []).map((x: any) => x.questions).filter(Boolean);
  return NextResponse.json({ test, questions });
}
