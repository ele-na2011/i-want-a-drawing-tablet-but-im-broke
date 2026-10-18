import { supabase } from "./supabase";

export function signInWithGoogle() {
  if (!supabase) {
    return Promise.reject(new Error("Supabase authentication is not configured."));
  }
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      scopes: "https://www.googleapis.com/auth/drive.file",
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}