import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthValue = { session: Session | null; loading: boolean; googleToken: string | null };

const AuthCtx = createContext<AuthValue>({ session: null, loading: true, googleToken: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(
    sessionStorage.getItem("g_token")
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.provider_token) {
        setGoogleToken(s.provider_token);
        sessionStorage.setItem("g_token", s.provider_token);
      }
      if (!s) {
        setGoogleToken(null);
        sessionStorage.removeItem("g_token");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ session, loading, googleToken }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);