import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Dashboard-only endpoint: reads this student's recent attempts only.
// It intentionally avoids the cross-student leaderboard aggregation.
export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: authData, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
    if (!(await isRegisteredStudentDevice(req, authData.user.id))) return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });

    const { data: attempts, error: attemptsError } = await db.from("test_attempts")
      .select("id,test_id,started_at,submitted_at,answers,total_questions")
      .eq("user_id", authData.user.id)
      .eq("is_submitted", true)
      .order("submitted_at", { ascending: false })
      .limit(100);
    if (attemptsError) throw attemptsError;
    if (!attempts?.length) return NextResponse.json({ weakAreas: [], subjectPace: [] }, { headers: { "Cache-Control": "private, no-store" } });

    const attemptIds = attempts.map(a => a.id);
    const testIds = [...new Set(attempts.map(a => a.test_id).filter(Boolean))];
    const [{ data: questionRows, error: questionError }, { data: papers, error: papersError }] = await Promise.all([
      db.from("test_attempt_questions").select("attempt_id,question_snapshot").in("attempt_id", attemptIds),
      db.from("test_papers").select("id,subject_id,subject:subjects(name_en,name_hi)").in("id", testIds)
    ]);
    if (questionError) throw questionError;
    if (papersError) throw papersError;

    const attemptMap = new Map(attempts.map(a => [a.id, a]));
    const paperMap = new Map((papers || []).map((p: any) => [p.id, p]));
    const chapterMap = new Map<string, any>();
    const paceMap = new Map<string, any>();

    for (const row of questionRows || []) {
      const attempt = attemptMap.get(row.attempt_id);
      const q: any = row.question_snapshot || {};
      const paper: any = attempt ? paperMap.get(attempt.test_id) : null;
      if (!attempt || !paper) continue;
      const subject = paper.subject?.name_en || paper.subject?.name_hi || "General";
      const chapter = String(q.chapter || "Uncategorised");
      const key = paper.subject_id + ":" + chapter;
      const item = chapterMap.get(key) || { subject, chapter, attempted: 0, correct: 0, wrong: 0, skipped: 0 };
      const selected = attempt.answers?.[q.id];
      const correctIndex = ["A", "B", "C", "D"].indexOf(String(q.correct_option || "").toUpperCase());
      const selectedIndex = selected === undefined || selected === null ? null : Number(selected);
      item.attempted++;
      if (selectedIndex === null || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) item.skipped++;
      else if (selectedIndex === correctIndex && correctIndex >= 0) item.correct++;
      else item.wrong++;
      chapterMap.set(key, item);
    }

    for (const attempt of attempts) {
      const paper: any = paperMap.get(attempt.test_id);
      if (!paper) continue;
      const subject = paper.subject?.name_en || paper.subject?.name_hi || "General";
      const seconds = attempt.started_at && attempt.submitted_at
        ? Math.max(0, (new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 1000)
        : 0;
      if (!seconds) continue;
      const item = paceMap.get(paper.subject_id) || { subject, seconds: 0, questions: 0, tests: 0 };
      item.seconds += seconds;
      item.questions += Number(attempt.total_questions || 0);
      item.tests++;
      paceMap.set(paper.subject_id, item);
    }

    const weakAreas = [...chapterMap.values()]
      .map(item => ({ ...item, accuracy: item.attempted ? Math.round(item.correct / item.attempted * 100) : 0 }))
      .filter(item => item.attempted >= 2 && item.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted)
      .slice(0, 8);
    const subjectPace = [...paceMap.values()]
      .map(item => ({ ...item, avgSecondsPerQuestion: item.questions ? Math.round(item.seconds / item.questions) : 0 }))
      .sort((a, b) => b.avgSecondsPerQuestion - a.avgSecondsPerQuestion)
      .slice(0, 8);

    return NextResponse.json({ weakAreas, subjectPace }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("STUDY_INSIGHTS_ERROR", error);
    return NextResponse.json({ error: error.message || "Unable to calculate study insights." }, { status: 500 });
  }
}
