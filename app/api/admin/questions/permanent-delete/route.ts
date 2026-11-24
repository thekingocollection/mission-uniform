import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

async function requireQuestionAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles")
    .select("role,permissions,is_blocked").eq("id", data.user.id).maybeSingle();
  if (!profile || profile.is_blocked) return null;
  const allowed = profile.role === "super_admin" ||
    (profile.role === "staff_admin" && Boolean(profile.permissions?.manage_questions));
  return allowed ? data.user : null;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireQuestionAdmin(req);
    if (!admin) return NextResponse.json({ error: "Question Bank admin access required." }, { status: 403 });

    const body = await req.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map((id: unknown) => String(id)))] : [];
    if (!ids.length || ids.length > 100) {
      return NextResponse.json({ error: "Select between 1 and 100 questions per permanent-delete batch." }, { status: 400 });
    }
    if (ids.some((id: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      return NextResponse.json({ error: "One or more question IDs are invalid." }, { status: 400 });
    }

    const db = getServiceSupabase();
    const [paperLinks, seenLinks, attemptLinks] = await Promise.all([
      db.from("test_paper_questions").select("question_id").in("question_id", ids).limit(1),
      db.from("student_subject_question_seen").select("question_id").in("question_id", ids).limit(1),
      db.from("test_attempt_questions").select("question_id").in("question_id", ids).limit(1)
    ]);
    const checkError = paperLinks.error || seenLinks.error || attemptLinks.error;
    if (checkError) {
      return NextResponse.json({
        error: "Could not verify all test/history references, so no questions were deleted. " + checkError.message
      }, { status: 500 });
    }

    const linked = Boolean(paperLinks.data?.length || seenLinks.data?.length || attemptLinks.data?.length);
    if (linked) {
      return NextResponse.json({
        error: "Some selected questions are linked to a test or student history. No questions were deleted. Use Archive Selected to preserve existing records."
      }, { status: 409 });
    }

    const { data: deleted, error: deleteError } = await db.from("questions")
      .delete().in("id", ids).select("id");
    if (deleteError) throw deleteError;
    const deletedCount = deleted?.length || 0;
    return NextResponse.json({ success: true, deleted_count: deletedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Permanent delete failed." }, { status: 500 });
  }
}
