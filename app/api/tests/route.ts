import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key);
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get("type");
    const db = getServiceSupabase();
    let q = db.from("test_papers").select("id,title,description,test_type,subject_id,chapter,duration_minutes,total_questions,marks_per_question,negative_marking,status,created_at").eq("status","published").order("created_at",{ascending:false});
    if (type) q = q.eq("test_type", type);
    const { data, error } = await q;
    if (error) return NextResponse.json({error:error.message},{status:500});
    return NextResponse.json({tests:data ?? []});
  } catch (e:any) {
    return NextResponse.json({error:e.message || "Unable to load tests."},{status:500});
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authUser(req);
    if (!user) return NextResponse.json({error:"Please sign in."},{status:401});
    const db = getServiceSupabase();
    const {data:profile} = await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    if (profile?.role !== "super_admin") return NextResponse.json({error:"Super admin access required."},{status:403});
    const body = await req.json();
    const questionIds: string[] = body.question_ids ?? [];
    const {question_ids: _unused, ...paper} = body;
    if (!paper.title || !paper.test_type) return NextResponse.json({error:"Test title and type are required."},{status:400});
    if (paper.question_mode === "pool") {
      if (!paper.pool_id) return NextResponse.json({error:"Choose a question pool."},{status:400});
      const {data:pool,error:poolError}=await db.from("question_pools").select("id,total_questions,is_active").eq("id",paper.pool_id).single();
      if(poolError||!pool?.is_active) return NextResponse.json({error:"Question pool is unavailable."},{status:400});
      if(Number(paper.total_questions)<1||Number(paper.total_questions)>pool.total_questions) return NextResponse.json({error:"Test question count exceeds the pool size."},{status:400});
    }
    if (paper.question_mode === "manual" && questionIds.length !== Number(paper.total_questions)) {
      return NextResponse.json({error:"Manual test selected question count must match the test question count."},{status:400});
    }
    const {data:test,error}=await db.from("test_papers").insert({...paper,created_by:user.id}).select("*").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    if(questionIds.length) {
      const {data:valid,error:validError}=await db.from("questions").select("id").in("id",questionIds).eq("is_active",true).eq("verified",true);
      if(validError||(valid?.length??0)!==questionIds.length) {
        await db.from("test_papers").delete().eq("id",test.id);
        return NextResponse.json({error:"Only active and verified questions can be selected."},{status:400});
      }
      const links=questionIds.map((question_id,i)=>({test_id:test.id,question_id,sort_order:i+1}));
      const {error:linkError}=await db.from("test_paper_questions").insert(links);
      if(linkError){await db.from("test_papers").delete().eq("id",test.id);return NextResponse.json({error:linkError.message},{status:400});}
    }
    return NextResponse.json({test},{status:201});
  } catch(e:any) {
    console.error("TEST_CREATE_ERROR",e);
    return NextResponse.json({error:e.message||"Could not create test."},{status:500});
  }
}
