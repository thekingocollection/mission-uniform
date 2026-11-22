import {NextRequest,NextResponse} from "next/server";
import {getServiceSupabase} from "@/lib/server-supabase";

export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(req:NextRequest){
  try{
    const h=req.headers.get("authorization");
    if(!h?.startsWith("Bearer "))return NextResponse.json({error:"Please login first."},{status:401});
    const db=getServiceSupabase();
    const {data:u,error:ae}=await db.auth.getUser(h.slice(7));
    if(ae||!u.user)return NextResponse.json({error:"Session expired."},{status:401});

    const {data:attempts,error}=await db.from("test_attempts")
      .select("id,user_id,test_id,score,correct_count,wrong_count,skipped_count,total_questions,started_at,submitted_at")
      .eq("user_id",u.user.id).eq("is_submitted",true)
      .order("submitted_at",{ascending:false}).limit(300);
    if(error)throw error;

    const {data:allAttempts,error:allError}=await db.from("test_attempts")
      .select("user_id,test_id,score,correct_count,total_questions,submitted_at")
      .eq("is_submitted",true).order("submitted_at",{ascending:false}).limit(10000);
    if(allError)throw allError;
    const best=new Map<string,any>();
    for(const a of allAttempts||[]){const k=a.user_id+":"+a.test_id,old=best.get(k);if(!old||Number(a.score||0)>Number(old.score||0))best.set(k,a);}
    const totals=new Map<string,any>();
    for(const a of best.values()){const t=totals.get(a.user_id)||{points:0,tests:0,correct:0,questions:0};t.points+=Math.max(0,Number(a.score||0));t.tests++;t.correct+=Number(a.correct_count||0);t.questions+=Number(a.total_questions||0);totals.set(a.user_id,t);}
    const ids=[...totals.keys()];let profiles:any[]=[];
    if(ids.length){const {data,error:pe}=await db.from("profiles").select("id,public_display_name").in("id",ids);if(pe)throw pe;profiles=data||[];}
    const names=new Map(profiles.map(p=>[p.id,p.public_display_name?.trim()||"Cadet "+String(p.id).slice(0,4).toUpperCase()]));
    const ranked=[...totals.entries()].map(([id,t])=>({user_id:id,name:names.get(id)||"Student Cadet",points:Math.round(t.points*100)/100,tests:t.tests,accuracy:t.questions?Math.round(t.correct/t.questions*100):0})).sort((a,b)=>b.points-a.points||b.tests-a.tests||b.accuracy-a.accuracy).map((r,i)=>({...r,rank:i+1}));

    let weakAreas:any[]=[];
    let subjectPace:any[]=[];
    if(attempts?.length){
      const attemptIds=attempts.map(a=>a.id);
      const testIds=[...new Set(attempts.map(a=>a.test_id))];
      const [{data:qRows,error:qError},{data:papers,error:pError}]=await Promise.all([
        db.from("test_attempt_questions").select("attempt_id,question_snapshot").in("attempt_id",attemptIds),
        db.from("test_papers").select("id,subject_id,subject:subjects(name_en,name_hi)").in("id",testIds)
      ]);
      if(qError)throw qError;if(pError)throw pError;
      const paperMap=new Map((papers||[]).map((p:any)=>[p.id,p]));
      const chapterMap=new Map<string,any>();
      const paceMap=new Map<string,any>();
      const attemptMap=new Map(attempts.map(a=>[a.id,a]));
      for(const row of qRows||[]){
        const q=row.question_snapshot||{};
        const a=attemptMap.get(row.attempt_id);if(!a)continue;
        const paper:any=paperMap.get(a.test_id);if(!paper)continue;
        const subject=paper.subject?.name_en||paper.subject?.name_hi||"General";
        const chapter=String(q.chapter||"Uncategorised");
        const key=paper.subject_id+":"+chapter;
        const item=chapterMap.get(key)||{subject,chapter,attempted:0,correct:0,wrong:0,skipped:0};
        const selected=a.answers?.[q.id];
        const correctIndex=["A","B","C","D"].indexOf(String(q.correct_option||"").toUpperCase());
        const selectedIndex=selected===undefined||selected===null?null:Number(selected);
        item.attempted++;
        if(selectedIndex===null||!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>3)item.skipped++;
        else if(selectedIndex===correctIndex&&correctIndex>=0)item.correct++;
        else item.wrong++;
        chapterMap.set(key,item);
      }
      for(const a of attempts){
        const paper:any=paperMap.get(a.test_id);if(!paper)continue;
        const subject=paper.subject?.name_en||paper.subject?.name_hi||"General";
        const seconds=a.started_at&&a.submitted_at?Math.max(0,(new Date(a.submitted_at).getTime()-new Date(a.started_at).getTime())/1000):0;
        if(!seconds)continue;
        const p=paceMap.get(paper.subject_id)||{subject,seconds:0,questions:0,tests:0};
        p.seconds+=seconds;p.questions+=Number(a.total_questions||0);p.tests++;paceMap.set(paper.subject_id,p);
      }
      weakAreas=[...chapterMap.values()].map(x=>({...x,accuracy:x.attempted?Math.round(x.correct/x.attempted*100):0})).filter(x=>x.attempted>=2&&x.accuracy<70).sort((a,b)=>a.accuracy-b.accuracy||b.attempted-a.attempted).slice(0,8);
      subjectPace=[...paceMap.values()].map(x=>({...x,avgSecondsPerQuestion:x.questions?Math.round(x.seconds/x.questions):0})).sort((a,b)=>b.avgSecondsPerQuestion-a.avgSecondsPerQuestion).slice(0,8);
    }
    return NextResponse.json({top:ranked.slice(0,50),me:ranked.find(r=>r.user_id===u.user.id)||null,weakAreas,subjectPace},{headers:{"Cache-Control":"private, no-store"}});
  }catch(e:any){
    console.error("LEADERBOARD_ERROR",e);
    return NextResponse.json({error:e.message||"Unable to calculate leaderboard."},{status:500});
  }
}
