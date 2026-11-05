import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

// Every browser gets an anonymous workspace from the server; signing in with
// Google (when the site has it configured) attaches that workspace to the account.
export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    isSignedIn: meQuery.data?.loginMethod === "google",
  }), [meQuery.data, meQuery.error, meQuery.isLoading]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    signInUrl: (returnTo = window.location.pathname + window.location.search) =>
      `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`,
    logout: async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/";
    },
  };
}
