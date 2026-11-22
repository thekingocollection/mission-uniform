import Link from "next/link";
import { EXAM_SUBJECTS } from "@/lib/exam-subjects";

export default function SyllabusPage() {
  return <main className="mu-study-page">
    <section className="mu-study-hero">
      <div><span className="mu-study-kicker">MISSION UNIFORM OP · STUDY COMMAND</span><h1>Know the syllabus.<br/><em>Own your preparation.</em></h1><p>Odisha Police exam ki taiyari ko subject aur chapter ke hisaab se plan karein. Ek topic complete karein, practice karein aur phir agle mission par badhein.</p><div className="mu-study-actions"><Link href="/subject-mock-test">Start Subject Practice ↗</Link><Link href="/tests">Explore Mock Tests →</Link></div></div>
      <div className="mu-study-odisha"><span>ODISHA</span><svg viewBox="0 0 210 230" role="img" aria-label="Stylized Odisha state map"><path d="M79 8 L105 17 L121 12 L138 28 L157 33 L165 52 L185 62 L176 83 L188 103 L171 119 L178 141 L159 154 L153 174 L132 180 L119 203 L99 195 L82 215 L67 197 L47 194 L40 175 L21 166 L30 145 L16 128 L29 109 L22 89 L40 76 L42 54 L61 45 L62 25 Z" fill="#e8c978" stroke="#fff1c9" strokeWidth="3" strokeLinejoin="round"/><path d="M51 70L91 80L132 60M35 116L81 122L151 102M48 159L93 147L159 153M83 28L91 80L81 122L93 147L82 197" fill="none" stroke="#94702e" strokeOpacity=".55" strokeWidth="2" strokeDasharray="3 4"/><circle cx="109" cy="110" r="6" fill="#173b50" stroke="#fff" strokeWidth="2"/></svg><b>ONE STATE · ONE GOAL</b><small>PREPARE WITH PRIDE</small></div>
    </section>
    <section className="mu-study-section-head"><div><span>YOUR LEARNING ROADMAP</span><h2>Explore subjects</h2><p>Choose a subject to view its chapters and continue topic-wise preparation.</p></div><div className="mu-study-count"><b>{EXAM_SUBJECTS.length.toString().padStart(2,"0")}</b><small>CORE SUBJECTS</small></div></section>
    <section className="mu-study-subject-grid">{EXAM_SUBJECTS.map((s,i)=><Link className="mu-study-subject-card" href={"/subjects/"+s.slug} key={s.slug}><span className="mu-study-number">{String(i+1).padStart(2,"0")}</span><span className="mu-study-book">▤</span><h3>{s.name}</h3><p>{s.description}</p><span className="mu-study-open">VIEW CHAPTERS <b>↗</b></span></Link>)}</section>
    <section className="mu-study-tip"><span>CADET STUDY RULE</span><h2>Learn → Practise → Review → Repeat</h2><p>Ek subject ko chhote daily targets mein baantiye. Chapter complete karne ke baad related questions aur timed mock test zaroor attempt karein.</p><Link href="/test-history">Review your test history →</Link></section>
  </main>;
}
