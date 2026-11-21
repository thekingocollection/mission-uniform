import Link from "next/link";
import { PageHero, InfoCards } from "@/components/content-page";
import { subjects } from "@/lib/data";

export default function SyllabusPage() {
  return <>
    <PageHero eyebrow="ODISHA POLICE PREPARATION" title="Exam Syllabus" desc="Choose a subject and continue your topic-wise preparation. Syllabus content can be updated from the admin chapter manager." />
    <section className="mu-dash-section">
      <div className="mu-section-title"><div><span className="mu-kicker">SUBJECT-WISE STUDY</span><h2>Explore subjects</h2></div></div>
      <div className="mu-feature-grid">
        {subjects.map((s:any) => <Link className="mu-feature-card" href={"/subjects/"+s.slug} key={s.slug}>
          <span className="mu-feature-icon blue">📘</span><span className="mu-feature-title">{s.name}</span>
          <span className="mu-feature-desc">{s.desc}</span><span className="mu-feature-go">View topics <b>↗</b></span>
        </Link>)}
      </div>
    </section>
    <section className="panel"><h2>How to use the syllabus</h2><p>Pick one subject, complete its chapters, then practise related questions and attempt a mock test.</p></section>
  </>;
}
