import createContextHook from "@nkzw/create-context-hook";
import { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { createURL } from "expo-linking";

import { supabase } from "@/lib/supabase";

/**
 * Result returned from auth operations. `error` is a user-friendly string.
 */
interface AuthResult {
  error: string | null;
}

/**
 * AuthProvider — manages the Supabase session and exposes sign-up / sign-in /
 * sign-out methods for email+password, Google OAuth, Apple OAuth, and phone OTP.
 *
 * Uses native Supabase Auth (not Rork Auth) because the app needs email/password
 * and phone sign-up in addition to social providers.
 */
export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const redirectTo = createURL("auth");

  /** Load the initial session on mount. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch {
        /* ignore — no session */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Sign up with email + password + name. Sends a confirmation email. */
  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return { error: error.message };
      // If the user is immediately signed in (email confirmation disabled), update their profile.
      if (data.user) {
        await supabase
          .from("profiles")
          .update({ name, handle: name.toLowerCase().replace(/[^a-z0-9]/g, "") })
          .eq("id", data.user.id);
      }
      return { error: null };
    },
    [],
  );

  /** Sign in with email + password. */
  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  /** Sign in with Google via OAuth redirect. */
  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) return { error: error.message };
      if (data.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      }
      return { error: null };
    } catch {
      return { error: "Couldn't open Google sign-in." };
    }
  }, [redirectTo]);

  /** Sign in with Apple via OAuth redirect. */
  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (error) return { error: error.message };
      if (data.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      }
      return { error: null };
    } catch {
      return { error: "Couldn't open Apple sign-in." };
    }
  }, [redirectTo]);

  /** Send an OTP code to a phone number (E.164 format, e.g. +15551234567). */
  const signInWithPhone = useCallback(async (phone: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  /** Verify the OTP code sent to the phone number. */
  const verifyOtp = useCallback(async (phone: string, token: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  /** Sign out and clear the session. */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    loading,
    isAuthed: !!user,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signInWithPhone,
    verifyOtp,
    signOut,
  };
});
