import { supabase } from "./supabase";

export function signInWithGoogle() {
  if (!supabase) {
    return Promise.reject(new Error("Supabase authentication is not configured."));
  }
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      scopes: "https://www.googleapis.com/auth/drive.file",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}