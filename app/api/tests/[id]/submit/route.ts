import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const authorization=req.headers.get("authorization");
    if(!authorization?.startsWith("Bearer "))return NextResponse.json({error:"Please sign in first."},{status:401});
    const token=authorization.slice(7);
    const db=getServiceSupabase();
    const {data:userData,error:authError}=await db.auth.getUser(token);
    const user=userData.user;
    if(authError||!user)return NextResponse.json({error:"Your login session has expired. Please login again."},{status:401});
    const {id}=await params;
    let body:any;
    try { body=await req.json(); }
    catch { return NextResponse.json({error:"Request body is invalid. Please submit again."},{status:400}); }
    const attemptId=String(body?.attempt_id||"");
    const answers=body?.answers;
    if(!attemptId||!answers||typeof answers!=="object"||Array.isArray(answers))
      return NextResponse.json({error:"Invalid attempt or answers."},{status:400});
    const {data:attempt,error:attemptError}=await db.from("test_attempts")
      .select("id,user_id,test_id,is_submitted,started_at")
      .eq("id",attemptId).eq("user_id",user.id).eq("test_id",id).maybeSingle();
    if(attemptError||!attempt)return NextResponse.json({error:"Attempt not found."},{status:404});
    if(attempt.is_submitted)return NextResponse.json({error:"This attempt has already been submitted."},{status:409});
    const {data:rows,error:rowsError}=await db.from("test_attempt_questions")
      .select("sort_order,question_snapshot").eq("attempt_id",attemptId).order("sort_order");
    if(rowsError)throw new Error(rowsError.message);
    if(!rows?.length)throw new Error("Saved attempt questions not found.");
    const questionIds=new Set(rows.map((row:any)=>String((row.question_snapshot||{}).id||"")));
    for(const [questionId,value] of Object.entries(answers as Record<string,unknown>)){
      if(!questionIds.has(questionId))return NextResponse.json({error:"Answer contains a question outside this attempt."},{status:400});
      if(value!==null&&(!Number.isInteger(Number(value))||Number(value)<0||Number(value)>3))
        return NextResponse.json({error:"One or more selected answers are invalid."},{status:400});
    }
    const {data:test,error:testError}=await db.from("test_papers")
      .select("marks_per_question,negative_marking").eq("id",id).single();
    if(testError)throw new Error(testError.message);
    let correct=0,wrong=0,skipped=0,score=0;
    const review=rows.map((row:any)=>{
      const q=row.question_snapshot||{};
      const value=answers[q.id];
      const selected=value===undefined||value===null?null:Number(value);
      const valid=selected!==null&&Number.isInteger(selected)&&selected>=0&&selected<=3;
      const correctOption=String(q.correct_option||"").toUpperCase();
      const correctIndex=["A","B","C","D"].indexOf(correctOption);
      let status:"correct"|"wrong"|"skipped";
      if(!valid){status="skipped";skipped++;}
      else if(correctIndex>=0&&selected===correctIndex){status="correct";correct++;score+=Number(test.marks_per_question??1);}
      else{status="wrong";wrong++;score-=Number(test.negative_marking??0);}
      const options=Array.isArray(q.options)?q.options.map((x:any)=>typeof x==="string"?x:String(x?.text??x?.value??"")):
        ["A","B","C","D"].map(k=>String(q.options?.[k]??""));
      return {
        id:q.id, question:q.question_hi||q.question_or||q.question_en||"", options,
        selected, correct_option:correctOption,
        explanation:q.explanation||q.explanation_hi||q.explanation_or||q.explanation_en||"",
        chapter:q.chapter||null, difficulty:q.difficulty||null, status
      };
    });
    score=Number(score.toFixed(2));
    const total=rows.length;
    const accuracy=Number((correct/total*100).toFixed(2));
    const {data:saved,error:saveError}=await db.from("test_attempts").update({
      answers,score,correct_count:correct,wrong_count:wrong,skipped_count:skipped,
      total_questions:total,submitted_at:new Date().toISOString(),is_submitted:true
    }).eq("id",attemptId).eq("user_id",user.id).eq("is_submitted",false).select("*").maybeSingle();
    if(saveError)throw new Error(saveError.message);
    if(!saved)return NextResponse.json({error:"Attempt already submitted."},{status:409});
    return NextResponse.json({success:true,attempt:saved,total,accuracy,review},{headers:{"Cache-Control":"no-store"}});
  }catch(e:any){
    console.error("TEST_SUBMIT_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to submit test."},{status:500});
  }
}
