import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";
import { isRegisteredStudentDevice } from "@/lib/verify-student-device";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Please sign in to view your test history." }, { status: 401 });
    }

    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(authorization.slice(7));
    const user = authData.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Your login session has expired. Please sign in again." }, { status: 401 });
    }

    if (!(await isRegisteredStudentDevice(req, user.id))) {
      return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    }

    const { data: attempts, error } = await db
      .from("test_attempts")
      .select("id,test_id,score,total_questions,correct_count,wrong_count,skipped_count,started_at,submitted_at,is_submitted")
      .eq("user_id", user.id)
      .eq("is_submitted", true)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    const testIds = [...new Set((attempts || []).map((attempt) => attempt.test_id).filter(Boolean))];
    let titleById = new Map<string, string>();

    if (testIds.length) {
      const { data: tests, error: testsError } = await db
        .from("test_papers")
        .select("id,title")
        .in("id", testIds);
      if (testsError) throw testsError;
      titleById = new Map((tests || []).map((test) => [test.id, test.title]));
    }

    const history = (attempts || []).map((attempt) => {
      const total = Number(attempt.total_questions || 0);
      const correct = Number(attempt.correct_count || 0);
      const wrong = Number(attempt.wrong_count || 0);
      const skipped = Number(attempt.skipped_count || Math.max(0, total - correct - wrong));
      return {
        id: attempt.id,
        test_id: attempt.test_id,
        title: titleById.get(attempt.test_id) || "Mock Test",
        score: Number(attempt.score || 0),
        total,
        correct,
        wrong,
        skipped,
        accuracy: total ? Number((correct / total * 100).toFixed(1)) : 0,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
      };
    });

    return NextResponse.json(
      { history, total_attempts: history.length },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    console.error("TEST_HISTORY_ERROR", error);
    return NextResponse.json({ error: error.message || "Unable to load test history." }, { status: 500 });
  }
}
