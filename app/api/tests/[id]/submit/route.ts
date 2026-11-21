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