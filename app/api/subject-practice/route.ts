import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET() {
  try {
    const db=getServiceSupabase();
    const {data:subjects,error}=await db.from("subjects").select("id,name_en,name_hi").eq("is_active",true).order("name_en");
    if(error) throw error;
    const output=[];
    for(const subject of subjects||[]) {
      const [{count:verifiedCount,error:countError},{data:test,error:testError}]=await Promise.all([
        db.from("questions").select("id",{count:"exact",head:true}).eq("subject_id",subject.id).eq("is_active",true).eq("verified",true),
        db.from("test_papers").select("id").eq("subject_id",subject.id).eq("question_mode","subject_random").eq("status","published").eq("is_previous_year",false).limit(1).maybeSingle()
      ]);
      if(countError) throw countError;
      if(testError) throw testError;
      if(test && (verifiedCount||0)>0) output.push({id:test.id,subject_id:subject.id,name_en:subject.name_en,name_hi:subject.name_hi,verified_questions:verifiedCount||0});
    }
    return NextResponse.json({subjects:output});
  } catch(e:any) {
    console.error("SUBJECT_PRACTICE_LIST_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to load subjects."},{status:500});
  }
}
