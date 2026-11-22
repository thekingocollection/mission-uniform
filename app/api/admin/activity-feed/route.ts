import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";

async function requireSuperAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!await requireSuperAdmin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const since = req.nextUrl.searchParams.get("since");
    const profileQuery = db.from("profiles")
      .select("id,student_code,full_name,created_at,role")
      .neq("role", "super_admin")
      .order("created_at", { ascending: false })
      .limit(12);
    const subjectQuery = db.from("subject_payment_transactions")
      .select("id,user_id,subject_id,amount_paise,status,paid_at,created_at,product_name,razorpay_payment_id")
      .order("created_at", { ascending: false }).limit(20);
    const deviceQuery = db.from("student_device_payments")
      .select("id,user_id,amount_paise,status,paid_at,created_at,razorpay_payment_id")
      .order("created_at", { ascending: false }).limit(20);
    const [profiles, subjectPayments, devicePayments, subjects] = await Promise.all([
      since ? profileQuery.gte("created_at", since) : profileQuery,
      since ? subjectQuery.gte("created_at", since) : subjectQuery,
      since ? deviceQuery.gte("created_at", since) : deviceQuery,
      db.from("subjects").select("id,name_en,name_hi")
    ]);
    for (const result of [profiles, subjectPayments, devicePayments, subjects]) {
      if (result.error) throw result.error;
    }
    const subjectById = new Map((subjects.data || []).map((s: any) => [s.id, s]));
    const events: any[] = (profiles.data || []).map((p: any) => ({
      id: "registration:" + p.id, kind: "registration", user_id: p.id,
      name: p.full_name || "New Student", student_code: p.student_code || "",
      created_at: p.created_at
    }));
    for (const p of subjectPayments.data || []) {
      if (p.status !== "paid" || !p.paid_at) continue;
      const subject: any = subjectById.get(p.subject_id);
      events.push({
        id: "purchase:" + p.id, kind: "purchase", user_id: p.user_id,
        name: subject?.name_en || subject?.name_hi || p.product_name || "Premium access",
        amount_paise: Number(p.amount_paise || 0), created_at: p.paid_at,
        reference: p.razorpay_payment_id || ""
      });
    }
    for (const p of devicePayments.data || []) {
      if (p.status !== "paid" || !p.paid_at) continue;
      events.push({
        id: "purchase:device:" + p.id, kind: "purchase", user_id: p.user_id,
        name: "Extra Device Registration", amount_paise: Number(p.amount_paise || 0),
        created_at: p.paid_at, reference: p.razorpay_payment_id || ""
      });
    }
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ events: events.slice(0, 30), checked_at: new Date().toISOString() }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not load admin activity." }, { status: 500 });
  }
}
