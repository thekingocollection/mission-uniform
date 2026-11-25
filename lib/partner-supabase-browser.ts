"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let partnerClient: SupabaseClient | null = null;

export function partnerSupabaseBrowser() {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  if (!partnerClient) {
    partnerClient = createClient(url, key, {
      auth: {
        storage: window.localStorage,
        storageKey: "mu-partner-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return partnerClient;
}
