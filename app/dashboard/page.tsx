"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SubjectTest = {
  id: string;
  title: string;
  total_questions: number;
  duration_minutes: number;
  subject: { name_en?: string | null; name_hi?: string | null } | { name_en?: string | null; name_hi?: string | null }[] | null;
};

function subjectName(test: SubjectTest) {
  const subject = Array.isArray(test.subject) ? test.subject[0] : test.subject;
  return subject?.name_en || subject?.name_hi || test.title;
}

export default function Dashboard() {
  const [name, setName] = useState("Student");
  const [attempts, setAttempts] = useState(0);
  const [tests, setTests] = useState<SubjectTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) {
        if (active) { setError("Student portal is temporarily unavailable."); setLoading(false); }
        return;
      }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        if (active) { setError("Please sign in to view your subject practice tests."); setLoading(false); }
        return;
      }
      const [{ data: profile }, { count }, response] = await Promise.all([
        sb.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        sb.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        fetch("/api/tests")
      ]);
      if (!active) return;
      if (profile?.full_name) setName(profile.full_name);
      setAttempts(count || 0);
      if (!response.ok) {
        setError("Subject-wise mock tests abhi load nahi ho pa rahe. Thodi der baad refresh karein.");
        setLoading(false);
        return;
      }
      const payload = await response.json();
      const subjectTests = (payload.tests || [])
        .filter((test: any) => test.question_mode === "subject_random" && !test.is_previous_year)
        .map((test: any) => ({
          id: test.id,
          title: test.title,
          total_questions: test.total_questions || 30,
          duration_minutes: test.duration_minutes || 30,
          subject: test.subject
        })) as SubjectTest[];
      setTests(subjectTests);
      setLoading(false);
    })().catch(() => {
      if (active) { setError("Tests load nahi ho paaye. Page refresh karke dobara try karein."); setLoading(false); }
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
            <div><b>{tests.length}</b><span>Subject tests ready</span></div>
          </div>
        </div>
        <div className="mu-student-emblem" aria-hidden="true">
          <div className="mu-student-emblem-ring"><span>DISCIPLINE</span><b>MU</b><span>DEDICATION</span></div>
          <small>EK LAKSHYA · EK JUNOON</small>
        </div>
      </section>

      <section className="mu-student-quote">
        <span>AAJ KA SANKALP</span>
        <h2>“Selection ek din mein nahi hota, lekin har din ki taiyari se zaroor hota hai.”</h2>
        <p>Focus rakhiye. Practice kijiye. Apne aap par bharosa rakhiye.</p>
      </section>

      <section className="mu-student-subject-section">
        <div className="mu-student-section-heading">
          <div><span className="mu-kicker">PRACTICE · IMPROVE · REPEAT</span><h2>Subject-wise Mock Tests</h2><p>Har attempt mein 30 naye random questions ke saath practice karein.</p></div>
          <span className="mu-student-count">{tests.length} SUBJECTS</span>
        </div>
        {loading ? <div className="mu-student-empty">Aapke subject mock tests load ho rahe hain…</div> :
          error ? <div className="mu-student-empty">{error}</div> :
          tests.length === 0 ? <div className="mu-student-empty">Abhi koi subject mock test publish nahi hua hai. Admin ke publish karte hi yahan dikhega.</div> :
          <div className="mu-student-subject-grid">
            {tests.map((test, index) => (
              <article className="mu-student-subject-card" key={test.id}>
                <div className="mu-student-subject-number">{String(index + 1).padStart(2, "0")}</div>
                <div className="mu-student-subject-card-copy">
                  <span>SUBJECT PRACTICE</span>
                  <h3>{subjectName(test)}</h3>
                  <p>{test.total_questions} Random Questions <i>·</i> {test.duration_minutes} Minutes</p>
                </div>
                <Link href={"/tests/paper/" + test.id} className="mu-student-start">Start Mock Test <b>→</b></Link>
              </article>
            ))}
          </div>
        }
      </section>
      <p className="mu-student-signoff">MISSION UNIFORM OP <span>·</span> Your Dream. Your Uniform. Your Mission.</p>
    </div>
  );
}
