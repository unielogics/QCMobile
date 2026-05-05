import { Link, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, Sparkline, StageBadge, QButton, SectionLabel } from "@/design-system/primitives";
import { QC_FMT } from "@/design-system/tokens";
import { useLoans } from "@/hooks/useApi";

const STAGE_KEYS = ["prequalified", "collecting_docs", "lender_connected", "processing", "closing", "funded"] as const;

// Synthetic 30-day sparkline trend (real version pulls from a /rates/{sku}/history endpoint)
const synthSpark = (seed: number) =>
  Array.from({ length: 30 }, (_, i) => Math.sin(i / 5 + seed) * 0.05 + 0.07 + seed / 1000);

const RATES = [
  { id: "FF-90", label: "Fix & Flip · 90% LTC", rate: 0.0925, delta: -8 },
  { id: "GU-85", label: "Ground Up · 85% LTC", rate: 0.1025, delta: 4 },
  { id: "DSCR-80", label: "DSCR · 80% LTV", rate: 0.0785, delta: 0 },
  { id: "BR-75", label: "Bridge · 75% LTV", rate: 0.0985, delta: 12 },
];

export default function Home() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: loans = [] } = useLoans();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.4, textTransform: "uppercase" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: t.ink, marginTop: 4 }}>
            Welcome back.
          </Text>
        </View>

        {/* Loan pipeline FIRST (per chat1.md final state) */}
        <Card pad={16}>
          <SectionLabel>Your loans</SectionLabel>
          {loans.length === 0 && (
            <Text style={{ color: t.ink3, fontSize: 13 }}>
              No loans yet. Connect to backend (run docker compose + alembic + seed).
            </Text>
          )}
          {loans.slice(0, 3).map((l) => (
            <Link key={l.id} href={`/loan/${l.id}`} asChild>
              <Card pad={12} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>{l.deal_id}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink, marginTop: 2 }}>{l.address}</Text>
                    <Text style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>
                      {QC_FMT.short(Number(l.amount))} · {l.type.replace("_", " ")}
                    </Text>
                  </View>
                  <StageBadge stage={STAGE_KEYS.indexOf(l.stage)} />
                </View>
              </Card>
            </Link>
          ))}
          <View style={{ marginTop: 4 }}>
            <QButton variant="secondary" label="+ Add new loan" />
          </View>
        </Card>

        {/* Today's market rates with sparklines */}
        <Card pad={16}>
          <SectionLabel>Today's market rates</SectionLabel>
          {RATES.map((r) => (
            <View key={r.id} style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{r.label}</Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 4 }}>
                  {(r.rate * 100).toFixed(3)}%
                </Text>
                <Text style={{ fontSize: 11, color: r.delta > 0 ? t.danger : r.delta < 0 ? t.profit : t.ink3, fontWeight: "700", marginTop: 2 }}>
                  {QC_FMT.bps(r.delta)}
                </Text>
              </View>
              <Sparkline data={synthSpark(Math.abs(r.delta) + 0.5)} color={t.spark} width={100} height={36} />
            </View>
          ))}
        </Card>

        {/* Soft-pull gate */}
        <Card pad={16}>
          <SectionLabel>Unlock pro terms</SectionLabel>
          <Text style={{ fontSize: 13, color: t.ink2, marginBottom: 12 }}>
            Run a soft credit check to see real rates and start applications. No SSN. No score impact.
          </Text>
          <QButton variant="danger" label="Unlock Pro Terms · Soft Pull" onPress={() => router.push("/credit-pull")} />
        </Card>

        {/* Portfolio KPIs */}
        <Card pad={16}>
          <SectionLabel>Portfolio Health</SectionLabel>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Stat label="Equity Unlocked" value={QC_FMT.short(loans.reduce((s, l) => s + Number(l.amount) * 0.3, 0))} />
            <Stat label="Global DSCR" value={(loans.filter((l) => l.dscr).reduce((s, l) => s + Number(l.dscr), 0) / Math.max(1, loans.filter((l) => l.dscr).length)).toFixed(2)} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 4 }}>{value}</Text>
    </View>
  );
}
