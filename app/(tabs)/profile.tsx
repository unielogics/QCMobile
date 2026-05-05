import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, QButton, SectionLabel, Avatar } from "@/design-system/primitives";
import { useCreditCurrent } from "@/hooks/useApi";

export default function Profile() {
  const { t, isDark, toggle } = useTheme();
  const router = useRouter();
  const { data: credit } = useCreditCurrent();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 4 }}>
          <Avatar label="MH" color={t.petrol} size={56} />
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink }}>Marcus Holloway</Text>
            <Text style={{ fontSize: 12, color: t.ink3 }}>Tier II Borrower · Member since Jun 2024</Text>
          </View>
        </View>

        <Card pad={16}>
          <SectionLabel>Credit</SectionLabel>
          {credit ? (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 36, fontWeight: "800", color: t.ink }}>{credit.fico ?? "—"}</Text>
                <Pill bg={t.profitBg} color={t.profit}>Verified</Pill>
              </View>
              <Text style={{ fontSize: 12, color: t.ink3, marginBottom: 12 }}>
                Soft pull on file · valid through {credit.expires_at ? new Date(credit.expires_at).toLocaleDateString() : "—"}
              </Text>
              <View style={{ padding: 10, borderRadius: 8, backgroundColor: t.warnBg, marginBottom: 12 }}>
                <Text style={{ color: t.warn, fontSize: 12, fontWeight: "700" }}>
                  Re-running replaces the existing pull and resets the 90-day window.
                </Text>
              </View>
              <QButton label="Re-Run Soft Pull" variant="secondary" onPress={() => router.push("/credit-pull")} />
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink, marginBottom: 4 }}>Credit Not Yet Verified</Text>
              <Text style={{ fontSize: 12, color: t.ink2, marginBottom: 12 }}>
                Complete a soft pull to unlock real rates and the application flow.
              </Text>
              <QButton label="Start Soft Pull" variant="danger" onPress={() => router.push("/credit-pull")} />
            </View>
          )}
        </Card>

        <Card pad={16}>
          <SectionLabel>Appearance</SectionLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <QButton label={isDark ? "Switch to Light" : "Light Mode"} variant={isDark ? "secondary" : "primary"} onPress={() => isDark && toggle()} />
            </View>
            <View style={{ flex: 1 }}>
              <QButton label={!isDark ? "Switch to Dark" : "Dark Mode"} variant={!isDark ? "secondary" : "primary"} onPress={() => !isDark && toggle()} />
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
