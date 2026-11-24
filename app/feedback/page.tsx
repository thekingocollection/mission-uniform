"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";
type Subject={id:string;name_en:string|null;name_hi:string|null};
type Survey={id:string;subject_id:string;overall_rating:number;ease_rating:number;recommendation:number;favorite_feature:string;improvement:string|null;testimonial:string|null;testimonial_consent:boolean;reward_expires_at:string|null;created_at:string};
export default function FeedbackPage(){
 const sb=useMemo(()=>supabaseBrowser(),[]);
 const [subjects,setSubjects]=useState<Subject[]>([]);
 const [survey,setSurvey]=useState<Survey|null>(null);
 const [subject,setSubject]=useState("");
 const [rating,setRating]=useState(5);
 const [ease,setEase]=useState(5);
 const [recommendation,setRecommendation]=useState(10);
 const [feature,setFeature]=useState("Subject-wise mock tests");
 const [improvement,setImprovement]=useState("");
 const [testimonial,setTestimonial]=useState("");
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 async function headers(){const {data}=await sb!.auth.getSession();if(!data.session)throw new Error("Please login again.");return {Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"};}
 async function load(){try{const r=await fetch("/api/student/feedback",{headers:await headers(),cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load feedback.");setSubjects(d.subjects||[]);setSurvey(d.survey||null);if(d.subjects?.[0])setSubject(d.subjects[0].id);}catch(e:any){setError(e.message||"Could not load survey.");}}
 useEffect(()=>{if(sb)void load();else setError("Student portal unavailable.");},[sb]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSuccess("");try{const r=await fetch("/api/student/feedback",{method:"POST",headers:await headers(),body:JSON.stringify({subject_id:subject,overall_rating:rating,ease_rating:ease,recommendation,favorite_feature:feature,improvement,testimonial,testimonial_consent:consent})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Submission failed.");setSurvey({id:d.survey.id,subject_id:d.survey.subject_id,overall_rating:rating,ease_rating:ease,recommendation,favorite_feature:feature,improvement,testimonial,testimonial_consent:consent,reward_expires_at:d.reward_expires_at,created_at:d.survey.created_at});setSuccess(d.reward_granted?"Thank you! Your selected subject is now free for 3 days.":"Thank you! Your feedback has been saved. Your selected subject already has active access.");}catch(e:any){setError(e.message||"Could not submit survey.");}finally{setBusy(false);}}
 const rewardActive=!!survey?.reward_expires_at&&new Date(survey.reward_expires_at).getTime()>Date.now();
 return <main className="mu-feedback-page">
  <header className="mu-feedback-hero"><span className="mu-feedback-kicker">MISSION UNIFORM OP · STUDENT VOICE</span><h1>Your Feedback Makes Us Better.</h1><p>Share honest feedback about your learning experience. Complete this one-time survey to unlock one subject free for 3 days.</p><div className="mu-feedback-reward"><span>✦ STUDENT THANK-YOU BENEFIT</span><b>3 DAYS FREE</b><small>Choose any one available subject after submitting the survey.</small></div></header>
  {error&&<div className="mu-feedback-alert error" role="alert">{error}</div>}{success&&<div className="mu-feedback-alert success" role="status">{success}</div>}
  {survey?<section className="mu-feedback-done"><span className="mu-feedback-done-icon">✓</span><span className="mu-feedback-kicker">SURVEY SUBMITTED</span><h2>Thank you for helping us improve!</h2><p>Your one-time feedback has been recorded. {rewardActive?"Your 3-day subject access is active until "+new Date(survey.reward_expires_at!).toLocaleString("en-IN")+".":"Your reward window has ended or you already had active access."}</p><Link href="/subject-mock-test">Go to Subject Mock Tests →</Link><Link href="/dashboard">Back to Student Dashboard</Link></section>
  :<form className="mu-feedback-form" onSubmit={submit}>
   <div className="mu-feedback-form-head"><span>01 / YOUR EXPERIENCE</span><h2>Student Feedback Survey</h2><p>Honest answers help us improve. A positive rating is not required to receive the benefit.</p></div>
   <label className="mu-feedback-field">Choose one subject for your 3-day free access<select required value={subject} onChange={e=>setSubject(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name_en||s.name_hi||"Subject"}</option>)}</select></label>
   <fieldset className="mu-feedback-question"><legend>How would you rate MISSION UNIFORM OP overall?</legend><div className="mu-feedback-rating">{[1,2,3,4,5].map(n=><button type="button" key={n} className={rating===n?"active":""} onClick={()=>setRating(n)} aria-pressed={rating===n}>{n} ★</button>)}</div><small>1 = Needs improvement · 5 = Excellent</small></fieldset>
   <fieldset className="mu-feedback-question"><legend>How easy is the website to use on your phone?</legend><div className="mu-feedback-rating">{[1,2,3,4,5].map(n=><button type="button" key={n} className={ease===n?"active":""} onClick={()=>setEase(n)} aria-pressed={ease===n}>{n}</button>)}</div><small>1 = Difficult · 5 = Very easy</small></fieldset>
   <fieldset className="mu-feedback-question"><legend>How likely are you to recommend us to another student?</legend><div className="mu-feedback-rating compact">{Array.from({length:11},(_,i)=>i).map(n=><button type="button" key={n} className={recommendation===n?"active":""} onClick={()=>setRecommendation(n)} aria-pressed={recommendation===n}>{n}</button>)}</div><small>0 = Not likely · 10 = Very likely</small></fieldset>
   <label className="mu-feedback-field">Which feature do you find most useful?<select value={feature} onChange={e=>setFeature(e.target.value)}>{["Subject-wise mock tests","Daily special tests","Previous year questions","Performance & leaderboard","Syllabus and study material","Mobile-friendly experience","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="mu-feedback-field">What should we improve next? <span>Optional</span><textarea rows={4} maxLength={1500} value={improvement} onChange={e=>setImprovement(e.target.value)} placeholder="Tell us about any issue, missing feature or suggestion…"/></label>
   <label className="mu-feedback-field">Write a short review (optional) <span>Optional · honest feedback only</span><textarea rows={3} maxLength={500} value={testimonial} onChange={e=>setTestimonial(e.target.value)} placeholder="What did you like or what should we improve?"/></label>
   <label className="mu-feedback-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I allow MISSION UNIFORM OP to display my review publicly with my first name only. This is optional.</label>
   <button className="mu-feedback-submit" type="submit" disabled={busy||!subject}>{busy?"Submitting survey…":"Submit Feedback & Unlock 3 Days Free →"}</button>
   <p className="mu-feedback-privacy">One survey per student account. Your benefit is for completing honest feedback, not for giving a positive rating. Public display consent is optional.</p>
  </form>}
 </main>
}
