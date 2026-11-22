import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function isRegisteredStudentDevice(request: NextRequest, userId: string): Promise<boolean> {
  const deviceId = request.cookies.get("mu_device_id")?.value || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) return false;
  const db = getServiceSupabase();
  const { data, error } = await db.rpc("verify_student_device", { p_user_id: userId, p_device_id: deviceId });
  return !error && data === true;
}
