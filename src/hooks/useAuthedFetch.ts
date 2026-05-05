import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { api, type ApiOptions } from "@/lib/api";
import { useSession } from "@/store/session";

/**
 * Returns a fetcher that attaches the Clerk JWT when signed in.
 * Falls back to X-Dev-User when no Clerk session — backend dev mode handles it.
 */
export function useAuthedFetch() {
  const { getToken, isSignedIn } = useAuth();
  const devUser = useSession((s) => s.devUser);

  return useCallback(
    async <T>(path: string, opts: Omit<ApiOptions, "authToken" | "devUser"> = {}): Promise<T> => {
      const token = isSignedIn ? await getToken() : null;
      return api<T>(path, {
        ...opts,
        ...(token ? { authToken: token } : { devUser }),
      });
    },
    [getToken, isSignedIn, devUser]
  );
}
