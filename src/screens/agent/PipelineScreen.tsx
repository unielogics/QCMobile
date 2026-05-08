import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill } from "@/design-system/primitives";
import { QC_FMT } from "@/design-system/tokens";
import { TopBar } from "@/components/TopBar";
import { DealHealthPill } from "@/components/agent/DealHealthPill";
import { useClients, useLoans } from "@/hooks/useApi";
import { ClientStage, LoanStage } from "@/lib/enums.generated";

type Mode = "leads" | "deals";

const LEAD_STAGES: { value: ClientStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "verified", label: "Verified" },
  { value: "ready_for_lending", label: "Ready" },
];

const DEAL_STAGES: { value: LoanStage; label: string }[] = [
  { value: "prequalified", label: "Prequalified" },
  { value: "collecting_docs", label: "Collecting Docs" },
  { value: "lender_connected", label: "Lender Connected" },
  { value: "processing", label: "Processing" },
  { value: "closing", label: "Closing" },
];

export function PipelineScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("leads");
  const { data: clients = [] } = useClients("mine");
  const { data: loans = [] } = useLoans("mine");

  const leadGroups = useMemo(() => {
    const m = new Map<ClientStage, typeof clients>();
    for (const s of LEAD_STAGES) m.set(s.value, []);
    for (const c of clients) {
      if (c.stage && m.has(c.stage)) m.get(c.stage)!.push(c);
    }
    return m;
  }, [clients]);

  const dealGroups = useMemo(() => {
    const m = new Map<LoanStage, typeof loans>();
    for (const s of DEAL_STAGES) m.set(s.value, []);
    for (const l of loans) {
      if (l.stage !== "funded" && m.has(l.stage)) m.get(l.stage)!.push(l);
    }
    return m;
  }, [loans]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Pipeline" />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderRadius: 10, padding: 4, alignSelf: "stretch" }}>
          {(["leads", "deals"] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 7,
                  backgroundColor: active ? t.surface : "transparent",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? t.ink : t.ink3 }}>
                  {m === "leads" ? "Leads" : "Deals"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsHorizontalScrollIndicator={false}
      >
        {mode === "leads"
          ? LEAD_STAGES.map((s) => {
              const items = leadGroups.get(s.value) ?? [];
              return (
                <View key={s.value} style={{ width: 260 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1, color: t.ink3, textTransform: "uppercase" }}>{s.label}</Text>
                    <Pill bg={t.chip} color={t.ink2}>{items.length}</Pill>
                  </View>
                  <View style={{ gap: 8 }}>
                    {items.length === 0 ? (
                      <Card pad={14}><Text style={{ fontSize: 12, color: t.ink3 }}>Empty</Text></Card>
                    ) : items.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => router.push(`/agent/client/${c.id}` as Href)}
                        style={({ pressed }) => ({
                          backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 12,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink }} numberOfLines={1}>{c.name}</Text>
                        {c.city ? <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{c.city}</Text> : null}
                        {c.client_type ? (
                          <Pill bg={t.chip} color={t.ink2} style={{ marginTop: 8 }}>
                            {c.client_type === "buyer" ? "Buyer" : "Seller"}
                          </Pill>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })
          : DEAL_STAGES.map((s) => {
              const items = dealGroups.get(s.value) ?? [];
              return (
                <View key={s.value} style={{ width: 260 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1, color: t.ink3, textTransform: "uppercase" }}>{s.label}</Text>
                    <Pill bg={t.chip} color={t.ink2}>{items.length}</Pill>
                  </View>
                  <View style={{ gap: 8 }}>
                    {items.length === 0 ? (
                      <Card pad={14}><Text style={{ fontSize: 12, color: t.ink3 }}>Empty</Text></Card>
                    ) : items.map((l) => {
                      const c = clientById.get(l.client_id);
                      return (
                        <Pressable
                          key={l.id}
                          onPress={() => router.push(`/agent/loan/${l.id}` as Href)}
                          style={({ pressed }) => ({
                            backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 12,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          {c ? (
                            <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.5 }} numberOfLines={1}>{c.name}</Text>
                          ) : null}
                          <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink, marginTop: c ? 2 : 0 }} numberOfLines={1}>
                            {l.address || "Subject property"}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>{QC_FMT.short(l.amount)}</Text>
                            <DealHealthPill health={l.deal_health ?? null} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
      </ScrollView>
    </SafeAreaView>
  );
}
