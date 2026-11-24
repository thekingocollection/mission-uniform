import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const runtime = "nodejs";
const allowedPermissions = ["manage_students","manage_subjects","manage_questions","manage_tests","manage_jobs","manage_notifications","manage_feedback","manage_settings"];

async function requireSuperAdmin(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const db = getServiceSupabase();
  const { data, error } = await db.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("role,is_blocked").eq("id", data.user.id).maybeSingle();
  return profile?.role === "super_admin" && !profile.is_blocked ? data.user : null;
}
function cleanPermissions(value: any) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(allowedPermissions.filter(key => input[key] === true).map(key => [key, true]));
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();
  try {
    if (!await requireSuperAdmin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await req.json().catch(() => null);
    const fullName = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const permissions = cleanPermissions(body?.permissions);
    if (fullName.length < 2) return NextResponse.json({ error: "Enter the staff member's full name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    if (!Object.keys(permissions).length) return NextResponse.json({ error: "Select at least one staff permission." }, { status: 400 });

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message || "Staff account could not be created." }, { status: 400 });

    // Do not call set_staff_access through the service-role RPC client:
    // auth.uid() is null there, so the SQL function rejects even a verified Super Admin.
    // This route has already authenticated the caller and verified the Super Admin role.
    const { data: profile, error: profileError } = await db.from("profiles")
      .update({ role: "staff_admin", permissions, full_name: fullName })
      .eq("id", created.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !profile) {
      await db.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({
        error: "Staff profile could not be assigned; the new Auth account was rolled back. " + (profileError?.message || "Profile row was not created.")
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: created.user.id, email: created.user.email, full_name: fullName } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to create staff account." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const db = getServiceSupabase();
  try {
    if (!await requireSuperAdmin(req)) return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Staff email is required." }, { status: 400 });

    const { data: users, error: usersError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 });
    const target = users.users.find(user => (user.email || "").toLowerCase() === email);
    if (!target) return NextResponse.json({ error: "Staff account was not found." }, { status: 404 });

    const { data: profile, error } = await db.from("profiles")
      .update({ role: "student", permissions: {} })
      .eq("id", target.id)
      .eq("role", "staff_admin")
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!profile) return NextResponse.json({ error: "This account is not currently an assigned staff account." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to update staff access." }, { status: 500 });
  }
}
