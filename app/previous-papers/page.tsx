
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHero } from "@/components/content-page";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Page() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkLogin() {
      const supabase = supabaseBrowser();

      if (!supabase) {
        router.replace("/login?next=/previous-papers");
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login?next=/previous-papers");
        return;
      }

      setAuthorized(true);
      setChecking(false);
    }

    checkLogin();

    return () => {
      active = false;
    };
  }, [router]);

  if (checking || !authorized) {
    return (
      <main className="panel" style={{ padding: 40, textAlign: "center" }}>
        Checking student login...
      </main>
    );
  }

  return (
    <>
      <PageHero
        title="Previous Papers"
        desc="Access previous-year question papers and practice for your examination."
      />

      <section className="panel prose">
        <h2>Previous Papers</h2>
        <p>
          Only papers uploaded and verified by the admin
          should be treated as official previous-year papers.
        </p>
      </section>
    </>
  );
}
