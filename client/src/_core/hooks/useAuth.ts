import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// Combines Clerk session state with the app's own user record (role, credits).
export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const { isLoaded, isSignedIn } = useClerkAuth();
  const clerk = useClerk();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: isLoaded && Boolean(isSignedIn),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    await clerk.signOut();
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();
  }, [clerk, utils]);

  const state = useMemo(() => {
    const user = isSignedIn ? meQuery.data ?? null : null;
    return {
      user,
      loading: !isLoaded || (Boolean(isSignedIn) && meQuery.isLoading),
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [isLoaded, isSignedIn, meQuery.data, meQuery.error, meQuery.isLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading || state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
