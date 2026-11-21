import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";

async function authUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, key);
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const db = getServiceSupabase();
  let q = db.from("test_papers").select("id,title,description,test_type,subject_id,chapter,duration_minutes,total_questions,marks_per_question,negative_marking,status,created_at").eq("status","published").order("created_at",{ascending:false});
  if (type) q = q.eq("test_type",type);
  const {data,error}=await q;
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({tests:data ?? []});
}
export async function POST(req: NextRequest) {
  const user=await authUser(req);
  if(!user) return NextResponse.json({error:"Please sign in."},{status:401});
  const db=getServiceSupabase();
  const {data:profile}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="super_admin") return NextResponse.json({error:"Super admin access required."},{status:403});
  const body=await req.json();
  const {question_ids=[],...paper}=body;
  const {data:test,error}=await db.from("test_papers").insert({...paper,created_by:user.id}).select("*").single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  if(question_ids.length){
    const {data:valid}=await db.from("questions").select("id").in("id",question_ids).eq("is_active",true).eq("verified",true);
    if((valid?.length??0)!==question_ids.length){
      await db.from("test_papers").delete().eq("id",test.id);
      return NextResponse.json({error:"Only active and verified questions can be added. Check selected question IDs."},{status:400});
    }
    const rows=question_ids.map((question_id:string,i:number)=>({test_id:test.id,question_id,sort_order:i+1}));
    const {error:linkError}=await db.from("test_paper_questions").insert(rows);
    if(linkError){await db.from("test_papers").delete().eq("id",test.id);return NextResponse.json({error:linkError.message},{status:400});}
  }
  return NextResponse.json({test},{status:201});
}
