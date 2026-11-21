import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

async function getUser(req: NextRequest) {
  const token=req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!token||!url||!key)return null;
  const client=createClient(url,key);
  const {data}=await client.auth.getUser(token);
  return data.user??null;
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await getUser(req);
    if(!user)return NextResponse.json({error:"Mock test start karne ke liye login karein."},{status:401});
    const {id}=await params;
    const db=getServiceSupabase();
    const {data:started,error}=await db.rpc("start_mock_test_attempt",{p_test_id:id});
    if(error)return NextResponse.json({error:error.message},{status:400});
    const questions=(started?.questions??[]).map((q:any)=>({
      id:q.id,question_hi:q.question_hi,question_or:q.question_or,question_en:q.question_en,
      options:q.options,chapter:q.chapter??null,difficulty:q.difficulty??null
    }));
    return NextResponse.json({
      test:started.test,attempt_id:started.attempt_id,started_at:started.started_at??new Date().toISOString(),
      questions
    });
  } catch(e:any) {
    console.error("TEST_START_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to start mock test."},{status:500});
  }
}
