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

    const { data: catalog, error: catalogError } = await db.rpc("get_subject_practice_catalog_v1");
    if (catalogError) throw catalogError;
    const catalogMap = new Map((catalog || []).map((row: any) => [row.subject_id, row]));
    const output = examSubjects.map((subject: any) => {
      const row: any = catalogMap.get(subject.id) || {};
      return {
        id: row.test_id || null,
        subject_id: subject.id,
        name_en: subject.name_en,
        name_hi: subject.name_hi,
        verified_questions: Number(row.verified_questions || 0)
      };
    });
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