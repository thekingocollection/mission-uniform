import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/server-supabase";
import { isRegisteredStudentDevice } from "@/lib/verify-student-device";

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key);
  const { data } = await client.auth.getUser(token);
  return data.user ?? null;
}

async function requireAdmin(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return { user: null, db: null, response: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const db = getServiceSupabase();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "super_admin") return { user: null, db: null, response: NextResponse.json({ error: "Super admin access required." }, { status: 403 }) };
  return { user, db, response: null };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Please login." }, { status: 401 });
    const db = getServiceSupabase();
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "super_admin";
    if (!isAdmin && !(await isRegisteredStudentDevice(req, user.id))) return NextResponse.json({ error: "This account is not active on this registered device." }, { status: 403 });
    if (!isAdmin) {
      const { data: pyq } = await db.from("subjects").select("id").eq("name_en", "Previous Year Questions").eq("is_active", true).maybeSingle();
      if (!pyq) return NextResponse.json({ error: "Previous Year Questions subject is not configured." }, { status: 503 });
      const [{ data: pyqPurchase }, { data: config }] = await Promise.all([
        db.from("student_subject_access").select("expires_at").eq("user_id", user.id).eq("subject_id", pyq.id).maybeSingle(),
        db.from("subject_access_settings").select("is_enabled").eq("subject_id", pyq.id).maybeSingle()
      ]);
      const hasPurchase = Boolean(pyqPurchase && (!pyqPurchase.expires_at || new Date(pyqPurchase.expires_at).getTime() > Date.now()));
      if (config?.is_enabled === false || !hasPurchase) return NextResponse.json({ error: "Unlock Previous Year Questions for ₹29 to view papers." }, { status: 403 });
    }
    const admin = isAdmin && req.nextUrl.searchParams.get("admin") === "1";
    let query = db.from("previous_year_papers").select("id,title,exam_name,exam_year,session_label,description,source_label,pdf_url,pdf_file_name,status,created_at").order("exam_year", { ascending: false }).order("created_at", { ascending: false });
    if (!admin) query = query.eq("status", "published");
    const { data, error } = await query.limit(300);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ papers: data ?? [] }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to load previous papers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const examName = String(form.get("exam_name") || "").trim();
    const examYear = Number(form.get("exam_year"));
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size < 1 || file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF file required (maximum 20 MB)." }, { status: 400 });
    }
    if (!title || !examName || !Number.isInteger(examYear) || examYear < 2000 || examYear > 2100) {
      return NextResponse.json({ error: "Title, exam name and valid exam year are required." }, { status: 400 });
    }
    const db = auth.db!;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${examYear}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await db.storage.from("previous-year-papers").upload(path, await file.arrayBuffer(), { contentType: "application/pdf", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data: publicData } = db.storage.from("previous-year-papers").getPublicUrl(path);
    const payload = {
      title, exam_name: examName, exam_year: examYear,
      session_label: String(form.get("session_label") || "").trim() || null,
      description: String(form.get("description") || "").trim() || null,
      source_label: String(form.get("source_label") || "").trim() || null,
      pdf_path: path, pdf_url: publicData.publicUrl, pdf_file_name: file.name,
      status: String(form.get("status") || "draft") === "published" ? "published" : "draft",
      created_by: auth.user!.id
    };
    const { data, error } = await db.from("previous_year_papers").insert(payload).select("*").single();
    if (error) {
      await db.storage.from("previous-year-papers").remove([path]);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ paper: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not upload paper." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    if (!body.id || !["draft", "published", "archived"].includes(body.status)) return NextResponse.json({ error: "Paper ID and valid status are required." }, { status: 400 });
    const { data, error } = await auth.db!.from("previous_year_papers").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", body.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ paper: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not update paper." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Paper ID required." }, { status: 400 });
    const { data: paper, error: findError } = await auth.db!.from("previous_year_papers").select("pdf_path").eq("id", id).single();
    if (findError) return NextResponse.json({ error: findError.message }, { status: 404 });
    const { error } = await auth.db!.from("previous_year_papers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (paper?.pdf_path) await auth.db!.storage.from("previous-year-papers").remove([paper.pdf_path]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not delete paper." }, { status: 500 });
  }
}
