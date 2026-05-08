import { useState, useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ThemeProvider } from "@/design-system/ThemeProvider";
import { useCurrentUser } from "@/hooks/useApi";
import {
  usePushRegistration,
  useRegisterPushToken,
  usePushTapHandler,
} from "@/lib/notifications";

// React Query's `refetchOnWindowFocus` does nothing in React Native unless
// focusManager is told what counts as "focus". Hook it up to AppState so
// foregrounding the app re-validates queries — this is what makes a freshly
// demoted user (e.g. via demote_to_client.py) stop seeing super-admin chrome
// the next time they reopen the app instead of waiting for staleTime.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
    handleFocus(status === "active");
  });
  return () => sub.remove();
});

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // Loud at boot — silent failure leaves users stuck on a blank screen.
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to .env.");
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Role drives the post-sign-in destination: brokers land on the agent
  // experience, everyone else (clients + operators) lands on the borrower
  // tabs. We hold the redirect until /auth/me resolves so we don't flash
  // the wrong group.
  const { data: user } = useCurrentUser();

  // Kick off push-notification registration on first mount. Permission
  // prompt fires once; the resulting Expo push token is registered with
  // the backend via `useRegisterPushToken` so AI chat messages can fire
  // pushes. `usePushTapHandler` wires notification taps to deep-link
  // into the right loan thread.
  const push = usePushRegistration();
  useRegisterPushToken(push);
  usePushTapHandler();

  useEffect(() => {
    if (!isLoaded) return;
    const top = segments[0];
    const inAuthGroup = top === "(auth)";
    const inTabsGroup = top === "(tabs)";
    const inAgentGroup = top === "agent";

    if (!isSignedIn) {
      if (!inAuthGroup) router.replace("/(auth)/sign-in");
      return;
    }
    // Signed in. Wait for /auth/me before picking a leg, otherwise we
    // flash the wrong group on cold-start.
    if (!user) return;

    if (user.role === "broker") {
      if (inAuthGroup || inTabsGroup) router.replace("/agent/today");
    } else {
      if (inAuthGroup || inAgentGroup) router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments, router, user]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="agent" />
      <Stack.Screen name="loan/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="pipeline" options={{ presentation: "card" }} />
      <Stack.Screen name="credit-pull" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>
          <AuthGate />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
