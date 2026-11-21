"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabaseBrowser} from "@/lib/supabase-browser";
type Attempt={id:string;title:string;score:number;total:number;submitted_at:string};
export default function Page(){
 const [rows,setRows]=useState<Attempt[]>([]);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
 useEffect(()=>{(async()=>{const s=supabaseBrowser();if(s){const {data,error}=await s.from("attempts").select("id,title,score,total,submitted_at").order("submitted_at",{ascending:false}).limit(100);if(!error){setRows(data||[]);setLoading(false);return;}setMessage(error.message);}
 try{const local=JSON.parse(localStorage.getItem("muop-attempts")||"[]");setRows(local.map((x:any)=>({id:String(x.id),title:x.title,score:x.score,total:x.total,submitted_at:x.date})));}catch{}setLoading(false);})();},[]);
 return <section className="panel test-history-page"><span className="eyebrow">STUDENT PORTAL</span><h1>Test History</h1>{loading?<p>Loading attempts…</p>:rows.length===0?<p>No attempts saved yet. Complete a mock test to see your history.</p>:<div className="table-wrap"><table><thead><tr><th>Test</th><th>Score</th><th>Date</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.title}</td><td>{r.score}/{r.total}</td><td>{new Date(r.submitted_at).toLocaleString()}</td></tr>)}</tbody></table></div>}{message&&<p className="muted">Database note: {message}</p>}<p><Link href="/tests/daily">Take another test →</Link></p></section>;
}
