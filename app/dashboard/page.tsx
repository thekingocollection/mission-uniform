"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SubjectTest = {
  id: string;
  subject_id: string;
  name_en: string | null;
  name_hi: string | null;
  verified_questions: number;
};

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);
  const [subjects, setSubjects] = useState<SubjectTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Student portal is temporarily unavailable.");
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in to view subject mock tests.");
      const [{ data: profile }, { count }, response] = await Promise.all([
        sb.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        fetch("/api/subject-practice")
      ]);
      if (!active) return;
      if (profile?.full_name) setName(profile.full_name);
      setAttempts(count || 0);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Subject tests could not be loaded.");
      setSubjects(payload.subjects || []);
      setLoading(false);
    })().catch((e: any) => {
      if (active) { setError(e.message || "Tests load nahi ho paaye."); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="mu-student-home">
      <section className="mu-student-hero">
        <div className="mu-student-hero-copy">
          <span className="mu-kicker">MISSION UNIFORM OP · YOUR PREPARATION ZONE</span>
          <p className="mu-student-greeting">WELCOME BACK, {name.toUpperCase()}</p>
          <h1>Vardi ka sapna hai,<br /><em>toh haar maanna mana hai.</em></h1>
          <p className="mu-student-hero-lead">Har din ki mehnat aapko apne lakshya ke ek kadam kareeb le jaati hai. Aaj khud ko kal se behtar banaiye.</p>
          <div className="mu-student-hero-stats">
            <div><b>{attempts}</b><span>Tests attempted</span></div>
            <div><b>{subjects.length}</b><span>Subjects available</span></div>
          </div>
        </div>
        <div className="mu-student-emblem" aria-hidden="true">
          <div className="mu-student-emblem-ring"><span>DISCIPLINE</span><b>MU</b><span>DEDICATION</span></div>
          <small>EK LAKSHYA · EK JUNOON</small>
        </div>
      </section>
      <section className="mu-student-quote">
        <span>AAJ KA SANKALP</span>
        <h2>“Selection ek din mein nahi hota, lekin har din ki taiyari se zaroor hoti hai.”</h2>
        <p>Focus rakhiye. Practice kijiye. Apne aap par bharosa rakhiye.</p>
      </section>
      <section className="mu-student-subject-section">
        <div className="mu-student-section-heading">
          <div><span className="mu-kicker">PRACTICE · IMPROVE · REPEAT</span><h2>Subject-wise Mock Tests</h2><p>Subject chuniye, questions ki sankhya select kijiye aur apna random mock test shuru kijiye.</p></div>
          <span className="mu-student-count">{subjects.length} SUBJECTS</span>
        </div>
        {loading ? <div className="mu-student-empty">Subjects load ho rahe hain…</div> :
          error ? <div className="mu-student-empty">{error}</div> :
          subjects.length === 0 ? <div className="mu-student-empty">Abhi kisi subject mein verified questions available nahi hain.</div> :
          <div className="mu-student-subject-grid">
            {subjects.map((subject, index) => (
              <article className="mu-student-subject-card" key={subject.subject_id}>
                <div className="mu-student-subject-number">{String(index + 1).padStart(2, "0")}</div>
                <div className="mu-student-subject-card-copy">
                  <span>RANDOM SUBJECT PRACTICE</span>
                  <h3>{subject.name_en || subject.name_hi || "Subject"}</h3>
                  <p>Fresh random questions · Practice at your pace</p>
                </div>
                <Link href={"/subject-mock-test?subject=" + subject.subject_id} className="mu-student-start">Choose Questions <b>→</b></Link>
              </article>
            ))}
          </div>
        }
      </section>
      <p className="mu-student-signoff">MISSION UNIFORM OP <span>·</span> Your Dream. Your Uniform. Your Mission.</p>
    </div>
  );
}
