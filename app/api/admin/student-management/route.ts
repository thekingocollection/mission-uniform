import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function requireSuperAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}

// Directory requests stay lightweight: only the latest 500 records are loaded.
// Full export remains paginated and is used only when the admin clicks Download Excel.
async function loadStudents(db: ReturnType<typeof getServiceSupabase>, q: string, exportAll: boolean) {
  const columns = "id,student_code,full_name,email,phone,role,is_blocked,created_at";
  const pageSize = 500;
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = db.from("profiles")
      .select(columns, exportAll ? undefined : { count: "exact" })
      .neq("role", "super_admin")
      .order("created_at", { ascending: false });
    if (q) {
      const safe = q.replace(/[,%()]/g, "").replace(/[*]/g, "");
      if (safe) query = query.or(`student_code.ilike.%${safe}%,full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!exportAll || !data || data.length < pageSize) {
      return {
        students: rows.map((p: any) => ({ ...p, email: p.email || "", mobile: String(p.phone || "").replace(/^\\+91/, "") })),
        total: count ?? rows.length
      };
    }
    if (rows.length >= 50000) throw new Error("Export limit reached (50,000 profiles).");
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    const isExport = req.nextUrl.searchParams.get("export") === "1";
    const result = await loadStudents(db, q, isExport);
    if (isExport) {
      return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }
    const [subjects, grants] = await Promise.all([
      db.from("subjects").select("id,name_en,name_hi").eq("is_active", true).order("name_en"),
      db.from("student_subject_access").select("user_id,subject_id,expires_at")
    ]);
    if (subjects.error) throw subjects.error;
    if (grants.error) throw grants.error;
    const grantMap = new Map((grants.data || []).map((g: any) => [`${g.user_id}:${g.subject_id}`, g]));
    return NextResponse.json({
      students: result.students,
      total: result.total,
      hasMore: result.total > result.students.length,
      subjects: subjects.data || [],
      grants: Array.from(grantMap.entries()).map(([key, value]: any) => ({ key, ...value }))
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not load students." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin(req);
    if (!admin) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const db = getServiceSupabase();
    const body = await req.json();
    if (body.action === "grant" || body.action === "revoke") {
      const { user_id, subject_id, duration_days, reason } = body;
      if (!user_id || !subject_id) return NextResponse.json({ error: "Student and subject are required." }, { status: 400 });
      const { data: subject } = await db.from("subjects").select("id").eq("id", subject_id).maybeSingle();
      const { data: user } = await db.auth.admin.getUserById(user_id);
      if (!subject || !user.user) return NextResponse.json({ error: "Student or subject not found." }, { status: 404 });
      let expiresAt: string | null = null;
      if (body.action === "grant") {
        if (duration_days !== null && (!Number.isInteger(duration_days) || duration_days < 1 || duration_days > 3650)) return NextResponse.json({ error: "Duration must be lifetime or 1–3650 days." }, { status: 400 });
        expiresAt = duration_days === null ? null : new Date(Date.now() + duration_days * 86400000).toISOString();
        const { error } = await db.from("student_subject_access").upsert({ user_id, subject_id, purchased_at: new Date().toISOString(), expires_at: expiresAt, last_payment_id: null }, { onConflict: "user_id,subject_id" });
        if (error) throw error;
      } else {
        const { error } = await db.from("student_subject_access").delete().eq("user_id", user_id).eq("subject_id", subject_id);
        if (error) throw error;
      }
      const { error: auditError } = await db.from("student_access_grant_audit").insert({ user_id, subject_id, action: body.action === "grant" ? "granted" : "revoked", expires_at: expiresAt, reason: String(reason || "").slice(0, 500) || null, granted_by: admin.id });
      if (auditError) throw auditError;
      return NextResponse.json({ success: true, expires_at: expiresAt });
    }
    if (body.action === "message" || body.action === "broadcast") {
      const title = String(body.title || "").trim(), message = String(body.body || "").trim();
      if (!title || title.length > 120 || !message || message.length > 3000) return NextResponse.json({ error: "Title (1–120) and message (1–3000 characters) are required." }, { status: 400 });
      if (body.action === "message" && !body.user_id) return NextResponse.json({ error: "Choose a student." }, { status: 400 });
      const { error } = await db.from("student_messages").insert({ user_id: body.action === "message" ? body.user_id : null, is_broadcast: body.action === "broadcast", title, body: message, created_by: admin.id });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message || "Action failed." }, { status: 500 }); }
}
