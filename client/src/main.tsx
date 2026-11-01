import { trpc } from "@/lib/trpc";
import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Many queries trigger paid LLM calls server-side; don't silently re-run them
// on window focus or remount.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;
  if (window.location.pathname.startsWith("/sign-in")) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Set by ClerkTokenBridge so the tRPC client can attach the current session token
let getSessionToken: () => Promise<string | null> = async () => null;

function ClerkTokenBridge() {
  const { getToken, isLoaded, userId } = useAuth();
  getSessionToken = getToken;
  // Refetch everything when the signed-in user changes (sign in / sign out)
  useEffect(() => {
    if (isLoaded) queryClient.invalidateQueries();
  }, [isLoaded, userId]);
  return null;
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const token = await getSessionToken();
        const headers = new Headers(init?.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={clerkPublishableKey}
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    afterSignOutUrl="/"
  >
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ClerkTokenBridge />
        <ClerkLoaded>
          <App />
        </ClerkLoaded>
      </QueryClientProvider>
    </trpc.Provider>
  </ClerkProvider>
);
