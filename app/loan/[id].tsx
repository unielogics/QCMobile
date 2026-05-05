import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, StageBadge, SectionLabel } from "@/design-system/primitives";
import { useLoan } from "@/hooks/useApi";
import { QC_FMT } from "@/design-system/tokens";

const TABS = ["Activity", "Chat", "Docs"] as const;
type Tab = (typeof TABS)[number];
const STAGE_KEYS = ["prequalified", "collecting_docs", "lender_connected", "processing", "closing", "funded"];

export default function LoanFile() {
  const { t } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: loan } = useLoan(id);
  const [tab, setTab] = useState<Tab>("Activity");

  if (!loan) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
      <Text style={{ color: t.ink3 }}>Loading…</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 8 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: t.brand, fontWeight: "700" }}>← Back</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>{loan.deal_id}</Text>
          <StageBadge stage={STAGE_KEYS.indexOf(loan.stage)} />
          <Pill>{loan.type.replace("_", " ")}</Pill>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink }}>{loan.address}</Text>
        <Text style={{ fontSize: 12, color: t.ink3 }}>
          {loan.city} · {QC_FMT.short(Number(loan.amount))} · {loan.ltv ? `${(loan.ltv * 100).toFixed(0)}% LTV` : ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: t.line }}>
        {TABS.map((label) => (
          <Pressable key={label} onPress={() => setTab(label)} style={{
            paddingVertical: 12, paddingHorizontal: 16,
            borderBottomWidth: 2, borderBottomColor: tab === label ? t.brand : "transparent",
          }}>
            <Text style={{ color: tab === label ? t.ink : t.ink3, fontWeight: "700", fontSize: 13 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === "Activity" && (
          <Card pad={16}>
            <SectionLabel>Open tasks</SectionLabel>
            <Text style={{ color: t.ink3, fontSize: 13 }}>Activity feed renders from /api/v1/loans/{loan.deal_id}/activity (next pass).</Text>
          </Card>
        )}
        {tab === "Chat" && (
          <Card pad={16}>
            <SectionLabel>Loan chat</SectionLabel>
            <Text style={{ color: t.ink3, fontSize: 13 }}>AI conversation thread + suggestion chips coming next pass.</Text>
          </Card>
        )}
        {tab === "Docs" && (
          <Card pad={16}>
            <SectionLabel>Documents</SectionLabel>
            <Text style={{ color: t.ink3, fontSize: 13 }}>Doc list with verified/pending badges coming next pass.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
