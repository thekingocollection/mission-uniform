import { adminSupabaseBrowser } from "@/lib/admin-supabase-browser";

/**
 * Get a current admin access token from the shared browser auth client.
 * Refresh once when storage is empty or the access token is close to expiry.
 */
export async function getAdminAccessToken(forceRefresh = false): Promise<string | null> {
  const supabase = adminSupabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) console.warn("[admin-auth] getSession:", error.message);

  const session = data?.session;
  const expiresSoon = !!session?.expires_at &&
    session.expires_at <= Math.floor(Date.now() / 1000) + 60;

  if (forceRefresh || !session || expiresSoon) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      console.warn("[admin-auth] refreshSession:", refreshed.error.message);
      return null;
    }
    return refreshed.data.session?.access_token || null;
  }

  return session.access_token;
}

/** Retry an admin API request once with a freshly refreshed access token. */
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const firstToken = await getAdminAccessToken();
  if (!firstToken) throw new Error("Admin session is unavailable. Please sign in again.");

  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + token);
    return fetch(input, { ...init, headers, cache: "no-store" });
  };

  let response = await send(firstToken);
  if (response.status === 401) {
    const freshToken = await getAdminAccessToken(true);
    if (freshToken) response = await send(freshToken);
  }
  return response;
}
