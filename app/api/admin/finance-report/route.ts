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

async function readAll(db: ReturnType<typeof getServiceSupabase>, table: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    if (rows.length >= 50000) throw new Error("Finance report limit reached (50,000 rows per payment type).");
  }
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const [subjectPayments, devicePayments, profilesResult, subjectsResult, settingsResult] = await Promise.all([
      readAll(db, "subject_payment_transactions"),
      readAll(db, "student_device_payments"),
      db.from("profiles").select("id,student_code,full_name,role,is_blocked"),
      db.from("subjects").select("id,name_en,name_hi"),
      db.from("subject_access_settings").select("subject_id,duration_days")
    ]);
    if (profilesResult.error) throw profilesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (settingsResult.error) throw settingsResult.error;

    const authUsers: any[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      authUsers.push(...(data.users || []));
      if (!data.users || data.users.length < 1000) break;
      if (authUsers.length >= 50000) break;
    }
    const profileById = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));
    const authById = new Map(authUsers.map((u: any) => [u.id, u]));
    const subjectById = new Map((subjectsResult.data || []).map((s: any) => [s.id, s]));
    const durationBySubject = new Map((settingsResult.data || []).map((s: any) => [s.subject_id, s.duration_days]));

    const rows = [
      ...subjectPayments.map((p: any) => {
        const profile: any = profileById.get(p.user_id);
        const user: any = authById.get(p.user_id);
        const subject: any = subjectById.get(p.subject_id);
        const paidAt = p.paid_at || p.created_at || null;
        const days = p.access_duration_days ?? durationBySubject.get(p.subject_id) ?? null;
        const expiry = p.access_expires_at || (paidAt && days ? new Date(new Date(paidAt).getTime() + Number(days) * 86400000).toISOString() : null);
        return {
          id: p.id, type: "Subject Premium", student_id: profile?.student_code || "", user_id: p.user_id,
          student_name: profile?.full_name || user?.user_metadata?.full_name || "Student",
          mobile: String(user?.user_metadata?.phone || user?.user_metadata?.mobile || user?.phone || "").replace(/^\+91/, ""),
          email: user?.email || "", product: subject?.name_en || subject?.name_hi || p.product_name || "Subject",
          amount_paise: Number(p.amount_paise || 0), currency: "INR", status: p.status || "unknown",
          purchase_date: paidAt, duration_days: days, access_start: paidAt, access_expiry: expiry,
          razorpay_order_id: p.razorpay_order_id || "", razorpay_payment_id: p.razorpay_payment_id || ""
        };
      }),
      ...devicePayments.map((p: any) => {
        const profile: any = profileById.get(p.user_id);
        const user: any = authById.get(p.user_id);
        return {
          id: p.id, type: "Extra Device Registration", student_id: profile?.student_code || "", user_id: p.user_id,
          student_name: profile?.full_name || user?.user_metadata?.full_name || "Student",
          mobile: String(user?.user_metadata?.phone || user?.user_metadata?.mobile || user?.phone || "").replace(/^\+91/, ""),
          email: user?.email || "", product: "One-time extra device registration",
          amount_paise: Number(p.amount_paise || 0), currency: p.currency || "INR", status: p.status || "unknown",
          purchase_date: p.paid_at || p.created_at || null, duration_days: null,
          access_start: p.paid_at || null, access_expiry: null,
          razorpay_order_id: p.razorpay_order_id || "", razorpay_payment_id: p.razorpay_payment_id || ""
        };
      })
    ].sort((a, b) => new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime());

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const status = req.nextUrl.searchParams.get("status");
    const type = req.nextUrl.searchParams.get("type");
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const filtered = rows.filter(r => {
      const date = r.purchase_date ? new Date(r.purchase_date).toISOString().slice(0, 10) : "";
      return (!from || date >= from) && (!to || date <= to) &&
        (!status || r.status === status) && (!type || r.type === type) &&
        (!q || [r.student_id,r.student_name,r.mobile,r.email,r.product,r.razorpay_order_id,r.razorpay_payment_id].some(v => String(v || "").toLowerCase().includes(q)));
    });
    const paid = filtered.filter(r => r.status === "paid");
    const uniqueBuyers = new Set(paid.map(r => r.user_id)).size;
    const revenuePaise = paid.reduce((sum, r) => sum + r.amount_paise, 0);
    const byProduct = new Map<string, { buyers: Set<string>; purchases: number; revenue_paise: number }>();
    for (const r of paid) {
      const key = r.product;
      const item = byProduct.get(key) || { buyers: new Set<string>(), purchases: 0, revenue_paise: 0 };
      item.buyers.add(r.user_id); item.purchases += 1; item.revenue_paise += r.amount_paise; byProduct.set(key, item);
    }
    return NextResponse.json({
      rows: filtered, summary: {
        total_transactions: filtered.length, paid_purchases: paid.length, unique_buyers: uniqueBuyers,
        revenue_paise: revenuePaise, pending: filtered.filter(r => r.status === "created").length,
        failed: filtered.filter(r => ["failed","refunded"].includes(r.status)).length
      },
      products: Array.from(byProduct.entries()).map(([product, v]) => ({ product, buyers: v.buyers.size, purchases: v.purchases, revenue_paise: v.revenue_paise })).sort((a,b)=>b.revenue_paise-a.revenue_paise)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load finance report." }, { status: 500 });
  }
}
