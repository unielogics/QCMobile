import { useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ThemeProvider } from "@/design-system/ThemeProvider";
import { tokenCache } from "@/lib/clerk-token-cache";

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  // Loud at boot — silent failure leaves users stuck on a blank screen.
  throw new Error("EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to .env.");
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="loan/[id]" options={{ presentation: "card" }} />
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
