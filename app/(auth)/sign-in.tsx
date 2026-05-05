import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useSignIn } from "@clerk/clerk-expo";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, QButton, SectionLabel } from "@/design-system/primitives";

export default function SignInScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!isLoaded) return;
    setError(null);
    setLoading(true);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError(`Sign-in incomplete: ${attempt.status}`);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "errors" in e
        ? String((e as { errors: { message: string }[] }).errors[0]?.message ?? e)
        : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16, justifyContent: "center" }}>
      <Card pad={20}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.ink, marginBottom: 4 }}>Welcome back</Text>
        <Text style={{ fontSize: 13, color: t.ink3, marginBottom: 20 }}>Sign in to Qualified Commercial.</Text>

        <SectionLabel>Email</SectionLabel>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={t.ink4}
          style={{ backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, color: t.ink, marginBottom: 12 }}
        />

        <SectionLabel>Password</SectionLabel>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={t.ink4}
          style={{ backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, color: t.ink, marginBottom: 16 }}
        />

        {error && (
          <View style={{ padding: 10, borderRadius: 8, backgroundColor: t.dangerBg, marginBottom: 12 }}>
            <Text style={{ color: t.danger, fontSize: 12 }}>{error}</Text>
          </View>
        )}

        <QButton label={loading ? "Signing in…" : "Sign in"} onPress={onSubmit} />

        <Pressable onPress={() => router.push("/(auth)/sign-up")} style={{ marginTop: 16, alignItems: "center" }}>
          <Text style={{ color: t.brand, fontSize: 13, fontWeight: "700" }}>
            New here? Create an account
          </Text>
        </Pressable>
      </Card>
    </SafeAreaView>
  );
}
