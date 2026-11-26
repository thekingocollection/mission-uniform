import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

async function requireSuperAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!await requireSuperAdmin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const now = new Date();
    const onlineCutoff = new Date(now.getTime() - 75000).toISOString();
    // Daily reporting follows the India calendar day (00:00 IST), not UTC midnight.
    const IST_OFFSET_MS = 5 * 60 * 60 * 1000 + 30 * 60 * 1000;
    const indiaCalendarNow = new Date(now.getTime() + IST_OFFSET_MS);
    indiaCalendarNow.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(indiaCalendarNow.getTime() - IST_OFFSET_MS);
    const [studentCount, presence, started, submitted, partnerRows, partnerClicks, partnerReferrals, partnerCommissions, partnerPayoutRequests] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
      db.from("student_live_presence").select("user_id,last_seen_at,current_path,active_attempt_id").gte("last_seen_at", onlineCutoff).order("last_seen_at", { ascending: false }).limit(2000),
      db.from("test_attempts").select("id,user_id,test_id,started_at,is_submitted,score,correct_count,wrong_count,total_questions").gte("started_at", dayStart.toISOString()).limit(5000),
      db.from("test_attempts").select("id", { count: "exact", head: true }).eq("is_submitted", true).gte("submitted_at", dayStart.toISOString()),
      db.from("partners").select("id,display_name,referral_code,status").order("created_at",{ascending:false}).limit(1000),
      db.from("partner_clicks").select("id,partner_id,created_at,landing_path").gte("created_at",dayStart.toISOString()).order("created_at",{ascending:false}).limit(1000),
      db.from("partner_referrals").select("id,partner_id,created_at").gte("created_at",dayStart.toISOString()).order("created_at",{ascending:false}).limit(1000),
      db.from("partner_commissions").select("id,partner_id,created_at,status,commission_paise").gte("created_at",dayStart.toISOString()).order("created_at",{ascending:false}).limit(1000),
      db.from("partner_payout_requests").select("id,partner_id,requested_at,status,amount_paise").gte("requested_at",dayStart.toISOString()).order("requested_at",{ascending:false}).limit(500)
    ]);
    for (const result of [studentCount, presence, started, submitted, partnerRows, partnerClicks, partnerReferrals, partnerCommissions, partnerPayoutRequests]) if (result.error) throw result.error;

    const onlineIdsForLookup = [...new Set((presence.data || []).map((p: any) => p.user_id))];
    const studentsResult = onlineIdsForLookup.length
      ? await db.from("profiles").select("id,student_code,full_name,email,phone,role,is_blocked,created_at").in("id", onlineIdsForLookup).eq("role", "student")
      : { data: [], error: null };
    if (studentsResult.error) throw studentsResult.error;
    const students = studentsResult.data || [];
    const onlineRows = presence.data || [];
    const onlineIds = new Set(onlineRows.map((p: any) => p.user_id));
    const onlineStudents = students.filter((s: any) => onlineIds.has(s.id));
    const onlinePresenceById = new Map(onlineRows.map((p: any) => [p.user_id, p]));
    const activeIds = onlineRows.map((p: any) => p.active_attempt_id).filter(Boolean);
    const activeAttemptsResult = activeIds.length
      ? await db.from("test_attempts").select("id,user_id,test_id,started_at,total_questions").in("id", activeIds).eq("is_submitted", false)
      : { data: [], error: null };
    if (activeAttemptsResult.error) throw activeAttemptsResult.error;
    const activeAttempts = activeAttemptsResult.data || [];
    const activeByUser = new Map(activeAttempts.map((a: any) => [a.user_id, a]));
    const testIds = [...new Set(activeAttempts.map((a: any) => a.test_id))];
    const testsResult = testIds.length ? await db.from("test_papers").select("id,title").in("id", testIds) : { data: [], error: null };
    if (testsResult.error) throw testsResult.error;
    const testNames = new Map((testsResult.data || []).map((t: any) => [t.id, t.title]));
    const online = onlineStudents.map((s: any) => {
      const p: any = onlinePresenceById.get(s.id);
      const a: any = activeByUser.get(s.id);
      return {
        user_id: s.id, student_code: s.student_code || "", name: s.full_name || "Student",
        email: s.email || "", phone: s.phone || "", last_seen_at: p.last_seen_at,
        current_path: p.current_path || "/", is_taking_test: Boolean(a),
        attempt_id: a?.id || null, test_title: a ? (testNames.get(a.test_id) || "Mock Test") : "",
        test_started_at: a?.started_at || null
      };
    }).sort((a: any, b: any) => Number(b.is_taking_test) - Number(a.is_taking_test));

    const loggedInToday = onlineStudents.filter((student: any) => {
      const presenceRow: any = onlinePresenceById.get(student.id);
      return presenceRow?.last_seen_at && new Date(presenceRow.last_seen_at).getTime() >= dayStart.getTime();
    }).length;
    const attemptsToday = started.data || [];
    const activeAttemptsToday = attemptsToday.filter((a: any) => !a.is_submitted).length;
    const stats = {
      total_students: studentCount.count || 0,
      online_now: online.length,
      offline_now: Math.max(0, (studentCount.count || 0) - online.length),
      taking_test_now: online.filter((s: any) => s.is_taking_test).length,
      logged_in_today: loggedInToday,
      tests_started_today: attemptsToday.length,
      tests_submitted_today: submitted.count || 0,
      attempts_in_progress_today: activeAttemptsToday
    };
    const activity = attemptsToday.slice().sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 15);
    const activityUserIds = [...new Set(attemptsToday.map((a: any) => a.user_id))];
    const activityTestIds = [...new Set(attemptsToday.map((a: any) => a.test_id))];
    const [activityProfiles, activityTests] = await Promise.all([
      activityUserIds.length ? db.from("profiles").select("id,student_code,full_name").in("id", activityUserIds) : { data: [], error: null },
      activityTestIds.length ? db.from("test_papers").select("id,title").in("id", activityTestIds) : { data: [], error: null }
    ]);
    if (activityProfiles.error || activityTests.error) throw activityProfiles.error || activityTests.error;
    const profileMap = new Map((activityProfiles.data || []).map((s: any) => [s.id, s]));
    const activityTestMap = new Map((activityTests.data || []).map((t: any) => [t.id, t.title]));
    const performanceMap = new Map<string, any>();
    for (const attempt of attemptsToday) {
      const key = attempt.user_id;
      const current = performanceMap.get(key) || { user_id: key, tests_taken: 0, tests_submitted: 0, pending_tests: 0, total_score: 0, score_count: 0, last_test: "", last_started_at: "", latest_score: null };
      current.tests_taken += 1;
      if (attempt.is_submitted) {
        current.tests_submitted += 1;
        current.total_score += Number(attempt.score || 0);
        current.score_count += 1;
        if (current.latest_score === null || new Date(attempt.started_at).getTime() > new Date(current.last_started_at).getTime()) current.latest_score = Number(attempt.score || 0);
      } else current.pending_tests += 1;
      if (!current.last_started_at || new Date(attempt.started_at).getTime() > new Date(current.last_started_at).getTime()) {
        current.last_started_at = attempt.started_at;
        current.last_test = activityTestMap.get(attempt.test_id) || "Mock Test";
      }
      performanceMap.set(key, current);
    }
    const student_performance = [...performanceMap.values()].map((row: any) => {
      const profile: any = profileMap.get(row.user_id);
      return { ...row, student: profile?.full_name || "Student", student_code: profile?.student_code || "", average_score: row.score_count ? Number((row.total_score / row.score_count).toFixed(2)) : null };
    }).sort((x: any, y: any) => y.tests_taken - x.tests_taken);
    const recent_activity = activity.map((a: any) => {
      const s: any = profileMap.get(a.user_id);
      return { id: a.id, student: s?.full_name || "Student", student_code: s?.student_code || "", test: activityTestMap.get(a.test_id) || "Mock Test", started_at: a.started_at, submitted: Boolean(a.is_submitted), score: a.score, correct: a.correct_count, wrong: a.wrong_count, skipped: a.skipped_count, total: a.total_questions, accuracy: a.total_questions ? Number((Number(a.correct_count || 0) / Number(a.total_questions) * 100).toFixed(1)) : 0 };
    });
    const partners = partnerRows.data || [];
    const partnerMap = new Map(partners.map((p:any)=>[p.id,p]));
    const partnerStats = {
      total: partners.length,
      approved: partners.filter((p:any)=>p.status==="approved").length,
      pending: partners.filter((p:any)=>p.status==="pending").length,
      clicks_today: (partnerClicks.data||[]).length,
      referrals_today: (partnerReferrals.data||[]).length,
      commissions_today: (partnerCommissions.data||[]).filter((x:any)=>x.status!=="reversed").length,
      payout_requests_today: (partnerPayoutRequests.data||[]).length
    };
    const partnerActivity = [
      ...(partnerClicks.data||[]).map((x:any)=>({id:"click-"+x.id,kind:"click",partner_id:x.partner_id,at:x.created_at,detail:"Referral link visit",meta:x.landing_path||"/signup"})),
      ...(partnerReferrals.data||[]).map((x:any)=>({id:"referral-"+x.id,kind:"referral",partner_id:x.partner_id,at:x.created_at,detail:"New student referral",meta:"Student joined"})),
      ...(partnerCommissions.data||[]).map((x:any)=>({id:"commission-"+x.id,kind:"commission",partner_id:x.partner_id,at:x.created_at,detail:"Commission recorded",meta:(Number(x.commission_paise||0)/100).toLocaleString("en-IN",{style:"currency",currency:"INR"})+" · "+x.status})),
      ...(partnerPayoutRequests.data||[]).map((x:any)=>({id:"payout-"+x.id,kind:"payout",partner_id:x.partner_id,at:x.requested_at,detail:"Payout request",meta:(Number(x.amount_paise||0)/100).toLocaleString("en-IN",{style:"currency",currency:"INR"})+" · "+x.status}))
    ].map((x:any)=>({...x,partner_name:partnerMap.get(x.partner_id)?.display_name||"Partner",referral_code:partnerMap.get(x.partner_id)?.referral_code||""}))
      .sort((a:any,b:any)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,40);
    return NextResponse.json({ stats, online_students: online, recent_activity, student_performance, partner_stats: partnerStats, partner_activity: partnerActivity, refreshed_at: now.toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Live monitor could not load." }, { status: 500 });
  }
}
