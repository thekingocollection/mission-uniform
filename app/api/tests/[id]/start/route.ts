import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const authorization=req.headers.get("authorization");
    if(!authorization?.startsWith("Bearer ")) return NextResponse.json({error:"Please sign in first."},{status:401});
    const token=authorization.slice(7);
    const db=getServiceSupabase();
    const {data:userData,error:authError}=await db.auth.getUser(token);
    const user=userData.user;
    if(authError||!user)return NextResponse.json({error:"Your login session has expired. Please login again."},{status:401});
    const {id}=await params;
    const {data:started,error}=await db.rpc("start_mock_test_attempt",{p_test_id:id});
    if(error)return NextResponse.json({error:error.message},{status:400});
    const questions=(started?.questions??[]).map((q:any)=>({
      id:q.id,question_hi:q.question_hi,question_or:q.question_or,question_en:q.question_en,
      options:q.options,chapter:q.chapter??null,difficulty:q.difficulty??null
    }));
    return NextResponse.json({test:started.test,attempt_id:started.attempt_id,started_at:started.started_at??new Date().toISOString(),questions});
  }catch(e:any){
    console.error("TEST_START_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to start mock test."},{status:500});
  }
}
