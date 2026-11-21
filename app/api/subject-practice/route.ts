import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET() {
  try {
    const db = getServiceSupabase();
    const { data: subjects, error } = await db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en");
    if (error) throw error;

    const output = [];
    for (const subject of subjects || []) {
      const { data: test, error: testError } = await db.from("test_papers").select("id")
        .eq("subject_id", subject.id).eq("question_mode", "subject_random")
        .eq("status", "published").eq("is_previous_year", false).limit(1).maybeSingle();
      if (testError) throw testError;
      if (test) output.push({ id: test.id, subject_id: subject.id, name_en: subject.name_en, name_hi: subject.name_hi });
    }
    return NextResponse.json({ subjects: output });
  } catch (e: any) {
    console.error("SUBJECT_PRACTICE_LIST_ERROR", e);
    return NextResponse.json({ error: e.message || "Unable to load subjects." }, { status: 500 });
  }
}
