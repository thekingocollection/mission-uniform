import { isRegisteredStudentDevice } from "@/lib/verify-student-device";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const authorization=req.headers.get("authorization");
    if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Please sign in first."},{status:401});
    const token=authorization.slice(7);
    const service=getServiceSupabase();
    const {data:userData,error:authError}=await service.auth.getUser(token);
    if(authError||!userData.user)return NextResponse.json({error:"Your login session has expired. Please login again."},{status:401});
    if (!(await isRegisteredStudentDevice(req, userData.user.id))) return NextResponse.json({error:"This account is not active on this registered device."},{status:403});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!anon)return NextResponse.json({error:"Supabase public key is not configured."},{status:500});
    const studentDb=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
    const {id}=await params;
    const {data: targetTest,error: targetError}=await service.from("test_papers").select("id,subject_id,question_mode").eq("id",id).eq("status","published").maybeSingle();
    if(targetError||!targetTest)return NextResponse.json({error:"Test not found or not published."},{status:404});
    const {data:subject}=await service.from("subjects").select("name_en,name_hi").eq("id",targetTest.subject_id).maybeSingle();

    // Server-side 24-hour account trial. After expiry, a student must have
    // active paid access for the test's subject (or the subject is configured free).
    const trialEndsAt = new Date(new Date(userData.user.created_at).getTime() + 24 * 60 * 60 * 1000);
    const trialActive = Number.isFinite(trialEndsAt.getTime()) && trialEndsAt.getTime() > Date.now();
    const [{data:subjectConfig},{data:purchase}] = await Promise.all([
      service.from("subject_access_settings").select("price_paise,is_enabled").eq("subject_id",targetTest.subject_id).maybeSingle(),
      service.from("student_subject_access").select("expires_at").eq("user_id",userData.user.id).eq("subject_id",targetTest.subject_id).maybeSingle()
    ]);
    const paidAccessActive = Boolean(purchase && (!purchase.expires_at || new Date(purchase.expires_at).getTime() > Date.now()));
    const freeForever = Number(subjectConfig?.price_paise) === 0;
    if (!trialActive && !paidAccessActive && !freeForever) {
      return NextResponse.json({
        error:"Your 24-hour free access has ended. Unlock this subject with Premium to continue.",
        premium_required:true,
        trial_expires_at:trialEndsAt.toISOString()
      },{status:402});
    }
    const isOdiaGrammar=/odia\s*(grammar|language)|ଓଡ଼ିଆ\s*(ବ୍ୟାକରଣ|ଭାଷା)/i.test(String(subject?.name_en||subject?.name_hi||""));
    if(targetTest.question_mode==="subject_random"){
      const [{data:global},{data:setting}]=await Promise.all([
        service.from("subject_access_global").select("all_subjects_enabled").eq("singleton",true).maybeSingle(),
        service.from("subject_access_settings").select("is_enabled").eq("subject_id",targetTest.subject_id).maybeSingle()
      ]);
      if(global?.all_subjects_enabled===false||setting?.is_enabled===false)
        return NextResponse.json({error:"This subject is currently unavailable. Please contact Admin."},{status:403});
    }
    let body:any={};
    try { body=await req.json(); } catch {}
    const language=body.language==="or"?"or":"en";
    if(isOdiaGrammar&&language!=="or")return NextResponse.json({error:"Odia Grammar tests are available only in Odia."},{status:400});
    const rawCount=body.question_count;
    const questionCount=rawCount===undefined||rawCount===null?null:Number(rawCount);
    if(questionCount!==null&&(!Number.isInteger(questionCount)||questionCount<1||questionCount>100))
      return NextResponse.json({error:"Question count must be between 1 and 100."},{status:400});
    const {data:started,error}=await studentDb.rpc("start_mock_test_attempt",{p_test_id:id,p_question_count:questionCount});
    if(error)return NextResponse.json({error:error.message},{status:400});
    const questions=(started?.questions??[]).map((q:any)=>({
      id:q.id,question_hi:q.question_hi,question_or:q.question_or,question_en:q.question_en,
      options:q.options,chapter:q.chapter??null,difficulty:q.difficulty??null
    }));
    return NextResponse.json({test:{...started.test,negative_marking:0.25,subject_name_en:subject?.name_en||"",subject_name_or:subject?.name_hi||""},language,attempt_id:started.attempt_id,started_at:started.started_at??new Date().toISOString(),questions},{headers:{"Cache-Control":"no-store"}});
  }catch(e:any){
    console.error("TEST_START_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to start mock test."},{status:500});
  }
}
