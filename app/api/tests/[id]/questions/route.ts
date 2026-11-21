import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getServiceSupabase();
    const { data: test, error } = await db.from("test_papers")
      .select("id,title,description,test_type,duration_minutes,total_questions,marks_per_question,negative_marking,status,question_mode")
      .eq("id", id).eq("status", "published").maybeSingle();

    if (error || !test) {
      return NextResponse.json({ error: "Test not found or not published." }, { status: 404 });
    }

    let available = test.total_questions;
    if (test.question_mode === "pool") {
      const { count, error: countError } = await db.from("pool_questions")
        .select("id", { count: "exact", head: true })
        .eq("pool_id", (await db.from("test_papers").select("pool_id").eq("id", id).single()).data?.pool_id);
      if (countError) throw countError;
      available = count ?? 0;
    } else if (test.question_mode === "manual") {
      const { count, error: countError } = await db.from("manual_test_questions")
        .select("id", { count: "exact", head: true }).eq("test_id", id);
      if (countError) throw countError;
      available = count ?? 0;
    }

    return NextResponse.json({ test: { ...test, available_questions: available } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to load test." }, { status: 500 });
  }
}
