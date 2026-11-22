import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { filterExamSubjects } from "@/lib/exam-subjects";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    if (!(await isRegisteredStudentDevice(req, authData.user.id))) return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    const { data: subjects, error } = await db
      .from("subjects")
      .select("id,name_en,name_hi")
      .eq("is_active", true)
      .order("name_en");
    if (error) throw error;
    const examSubjects = filterExamSubjects(subjects || []);
    if (!examSubjects.length) {
      return NextResponse.json({ subjects: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Run each subject's two small metadata queries concurrently.
    // The old implementation waited for each subject in sequence, making
    // the student page progressively slower as subjects were added.
    const output = await Promise.all(examSubjects.map(async (subject) => {
      const [{ count, error: countError }, { data: test, error: testError }] = await Promise.all([
        db.from("questions")
          .select("id", { count: "exact", head: true })
          .eq("subject_id", subject.id)
          .eq("is_active", true)
          .eq("verified", true),
        db.from("test_papers")
          .select("id")
          .eq("subject_id", subject.id)
          .eq("question_mode", "subject_random")
          .eq("status", "published")
          .eq("is_previous_year", false)
          .limit(1)
          .maybeSingle()
      ]);
      if (countError) throw countError;
      if (testError) throw testError;
      return {
        id: test?.id || null,
        subject_id: subject.id,
        name_en: subject.name_en,
        name_hi: subject.name_hi,
        verified_questions: count || 0
      };
    }));
    return NextResponse.json(
      { subjects: output },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (e: any) {
    console.error("SUBJECT_PRACTICE_LIST_ERROR", e);
    return NextResponse.json(
      { error: e.message || "Unable to load subjects." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}