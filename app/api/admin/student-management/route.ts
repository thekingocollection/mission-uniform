import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role,is_blocked,permissions")
    .eq("id", data.user.id)
    .maybeSingle();

  // Older databases may not yet have the staff-RBAC columns. The role column
  // is part of the original schema, so fall back to it without weakening the
  // blocked-account check on databases where the newer columns exist.
  let resolvedProfile: any = profile;
  if (profileError && isMissingOptionalColumn(profileError)) {
    const fallback = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    if (fallback.error || !fallback.data) return null;
    resolvedProfile = { ...fallback.data, is_blocked: false, permissions: {} };
  }

  if (profileError && !isMissingOptionalColumn(profileError)) return null;
  if (!resolvedProfile || resolvedProfile.is_blocked || !["super_admin", "staff_admin"].includes(resolvedProfile.role)) {
    return null;
  }

  return {
    user: data.user,
    role: resolvedProfile.role as string,
    permissions: (resolvedProfile.permissions || {}) as Record<string, boolean>
  };
}

function isMissingOptionalColumn(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (message.includes("column") && (message.includes("does not exist") || message.includes("schema cache")));
}

/**
 * The core profile fields exist in the original schema. Newer installations
 * also have student_code, email and is_blocked. If an older database has not
 * applied those migrations yet, retry with the core fields instead of failing
 * the complete Student Directory request.
 */
async function loadStudents(db: ReturnType<typeof getServiceSupabase>, q: string, exportAll: boolean) {
  const pageSize = 500;
  const rows: any[] = [];
  let total = 0;
  let from = 0;
  let useExtendedColumns = true;

  for (;;) {
    const select = useExtendedColumns
      ? "id,student_code,full_name,email,phone,role,is_blocked,created_at"
      : "id,full_name,phone,role,created_at";

    let query = db.from("profiles")
      .select(select, { count: from === 0 ? "exact" : undefined })
      .neq("role", "super_admin")
      .order("created_at", { ascending: false });

    if (q) {
      const safe = q.replace(/[,%()]/g, "").replace(/[*]/g, "").trim();
      if (safe) {
        query = useExtendedColumns
          ? query.or(`student_code.ilike.%${safe}%,full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
          : query.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
    }

    const { data, error, count } = await query.range(from, from + pageSize - 1);

    // Retry once with schema-guaranteed fields if a newer optional column is
    // missing. Reset pagination so no records are skipped or duplicated.
    if (error && useExtendedColumns && isMissingOptionalColumn(error)) {
      useExtendedColumns = false;
      rows.length = 0;
      total = 0;
      from = 0;
      continue;
    }
    if (error) throw error;

    if (from === 0) total = count ?? 0;
    const pageRows = data || [];
    rows.push(...pageRows);

    if (!exportAll || pageRows.length < pageSize) break;
    from += pageSize;
    if (rows.length >= 50000) throw new Error("Export limit reached (50,000 profiles).");
  }

  const students = rows.map((profile: any) => ({
    ...profile,
    student_code: profile.student_code || null,
    email: profile.email || "",
    mobile: String(profile.phone || "").replace(/^\\+91/, ""),
    is_blocked: Boolean(profile.is_blocked)
  }));

  return { students, total };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireAdmin(req);
    if (!access) {
      return NextResponse.json({ error: "Admin access required. Please sign in again." }, { status: 403 });
    }

    if (access.role === "staff_admin" && !access.permissions.manage_students) {
      return NextResponse.json({ error: "Student directory permission is required." }, { status: 403 });
    }

    const db = getServiceSupabase();
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    const isExport = req.nextUrl.searchParams.get("export") === "1";
    const result = await loadStudents(db, q, isExport);

    if (access.role === "staff_admin" || isExport) {
      return NextResponse.json({
        students: result.students,
        total: result.total,
        hasMore: result.total > result.students.length,
        export: isExport
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Optional subject and premium-access metadata must not block student rows.
    const [subjectsResult, grantsResult] = await Promise.all([
      db.from("subjects").select("id,name,name_od,sort_order,published").order("sort_order"),
      db.from("student_subject_access").select("user_id,subject_id,expires_at")
    ]);

    const subjects = (subjectsResult.data || [])
      .filter((subject: any) => subject.published !== false)
      .map((subject: any) => ({
        id: subject.id,
        name_en: subject.name || "",
        name_hi: subject.name_od || ""
      }));

    return NextResponse.json({
      students: result.students,
      total: result.total,
      hasMore: result.total > result.students.length,
      subjects,
      grants: grantsResult.error ? [] : (grantsResult.data || []),
      warnings: [
        ...(subjectsResult.error ? ["Subjects could not be loaded: " + subjectsResult.error.message] : []),
        ...(grantsResult.error ? ["Premium access details could not be loaded: " + grantsResult.error.message] : [])
      ]
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("[admin/student-management GET]", error);
    return NextResponse.json({
      error: error?.message || "Could not load students.",
      code: error?.code || null
    }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireAdmin(req);
    if (!access || access.role !== "super_admin") {
      return NextResponse.json({ error: "Super Admin access required for student account changes." }, { status: 403 });
    }

    const admin = access.user;
    const db = getServiceSupabase();
    const body = await req.json();

    if (body.action === "grant" || body.action === "revoke") {
      const { user_id, subject_id, duration_days, reason } = body;
      if (!user_id || !subject_id) {
        return NextResponse.json({ error: "Student and subject are required." }, { status: 400 });
      }

      const [{ data: subject }, { data: user }] = await Promise.all([
        db.from("subjects").select("id").eq("id", subject_id).maybeSingle(),
        db.auth.admin.getUserById(user_id)
      ]);
      if (!subject || !user.user) {
        return NextResponse.json({ error: "Student or subject not found." }, { status: 404 });
      }

      let expiresAt: string | null = null;
      if (body.action === "grant") {
        if (duration_days !== null && (!Number.isInteger(duration_days) || duration_days < 1 || duration_days > 3650)) {
          return NextResponse.json({ error: "Duration must be lifetime or 1–3650 days." }, { status: 400 });
        }
        expiresAt = duration_days === null ? null : new Date(Date.now() + duration_days * 86400000).toISOString();
        const { error } = await db.from("student_subject_access").upsert({
          user_id, subject_id, purchased_at: new Date().toISOString(), expires_at: expiresAt, last_payment_id: null
        }, { onConflict: "user_id,subject_id" });
        if (error) throw error;
      } else {
        const { error } = await db.from("student_subject_access")
          .delete().eq("user_id", user_id).eq("subject_id", subject_id);
        if (error) throw error;
      }

      const { error: auditError } = await db.from("student_access_grant_audit").insert({
        user_id, subject_id, action: body.action === "grant" ? "granted" : "revoked",
        expires_at: expiresAt, reason: String(reason || "").slice(0, 500) || null, granted_by: admin.id
      });
      if (auditError) throw auditError;
      return NextResponse.json({ success: true, expires_at: expiresAt });
    }

    if (body.action === "reset_password") {
      const userId = String(body.user_id || "").trim();
      const password = String(body.password || "");
      if (!userId) return NextResponse.json({ error: "Choose a student." }, { status: 400 });
      if (password.length < 8 || password.length > 72) {
        return NextResponse.json({ error: "Password must be 8–72 characters long." }, { status: 400 });
      }
      const { data: target, error: lookupError } = await db.auth.admin.getUserById(userId);
      if (lookupError || !target.user) {
        return NextResponse.json({ error: "Student account not found." }, { status: 404 });
      }
      if (target.user.id === admin.id) {
        return NextResponse.json({ error: "You cannot reset your own password from Student Management." }, { status: 400 });
      }
      const { error: updateError } = await db.auth.admin.updateUserById(userId, { password });
      if (updateError) throw updateError;
      return NextResponse.json({ success: true, message: "Student password updated successfully." });
    }

    if (body.action === "message" || body.action === "broadcast") {
      const title = String(body.title || "").trim();
      const message = String(body.body || "").trim();
      if (!title || title.length > 120 || !message || message.length > 3000) {
        return NextResponse.json({ error: "Title (1–120) and message (1–3000 characters) are required." }, { status: 400 });
      }
      if (body.action === "message" && !body.user_id) {
        return NextResponse.json({ error: "Choose a student." }, { status: 400 });
      }
      const { error } = await db.from("student_messages").insert({
        user_id: body.action === "message" ? body.user_id : null,
        is_broadcast: body.action === "broadcast",
        title, body: message, created_by: admin.id
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error: any) {
    console.error("[admin/student-management POST]", error);
    return NextResponse.json({ error: error?.message || "Action failed." }, { status: 500 });
  }
}
