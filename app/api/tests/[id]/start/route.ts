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

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!anon)return NextResponse.json({error:"Supabase public key is not configured."},{status:500});
    // Call the security-definer RPC with the student's JWT so auth.uid() is the student.
    const studentDb=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
    const {id}=await params;
    const {data:started,error}=await studentDb.rpc("start_mock_test_attempt",{p_test_id:id});
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
