import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, StageBadge } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { QC_FMT } from "@/design-system/tokens";
import { TopBar } from "@/components/TopBar";
import { DealHealthPill } from "@/components/agent/DealHealthPill";
import { useClients, useLoans } from "@/hooks/useApi";
import { ClientStage, LoanStage, LoanStageOptions } from "@/lib/enums.generated";
import type { Client, Loan } from "@/lib/types";

type Mode = "files" | "leads";

const RELATIONSHIP_STAGES: { value: ClientStage; label: string }[] = [
  { value: "lead", label: "New" },
  { value: "contacted", label: "Nurturing" },
  { value: "verified", label: "Qualified" },
  { value: "ready_for_lending", label: "Handoff" },
  { value: "processing", label: "Funding" },
  { value: "funded", label: "Closed" },
];

const DEAL_STAGES: { value: LoanStage; label: string }[] = [
  { value: "prequalified", label: "Prequalified" },
  { value: "collecting_docs", label: "Collecting Docs" },
  { value: "lender_connected", label: "Lender Connected" },
  { value: "processing", label: "Processing" },
  { value: "closing", label: "Closing" },
];

const STAGE_INDEX = new Map<LoanStage, number>(
  LoanStageOptions.map((o, index) => [o.value, index])
);

export function PipelineScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("files");
  const { data: clients = [] } = useClients("mine");
  const { data: loans = [] } = useLoans("mine");

  const leadGroups = useMemo(() => {
    const activeByClient = new Map<string, number>();
    for (const l of loans) {
      if (l.stage !== "funded") activeByClient.set(l.client_id, (activeByClient.get(l.client_id) ?? 0) + 1);
    }
    const m = new Map<ClientStage, (Client & { _stage: ClientStage; _activeFiles: number })[]>();
    for (const s of RELATIONSHIP_STAGES) m.set(s.value, []);
    for (const c of clients) {
      const activeFiles = activeByClient.get(c.id) ?? 0;
      const stage = inferClientStage(c, activeFiles);
      if (m.has(stage)) m.get(stage)!.push({ ...c, _stage: stage, _activeFiles: activeFiles });
    }
    return m;
  }, [clients, loans]);

  const dealGroups = useMemo(() => {
    const m = new Map<LoanStage, typeof loans>();
    for (const s of DEAL_STAGES) m.set(s.value, []);
    for (const l of loans) {
      if (l.stage !== "funded" && m.has(l.stage)) m.get(l.stage)!.push(l);
    }
    return m;
  }, [loans]);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const activeFiles = useMemo(() => loans.filter((l) => l.stage !== "funded"), [loans]);
  const fileValue = useMemo(() => activeFiles.reduce((sum, l) => sum + Number(l.amount || 0), 0), [activeFiles]);
  const relationshipCount = clients.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Pipeline" />

      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <Card pad={16} style={{ borderRadius: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name="layers" size={19} color={t.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}>Agent command center</Text>
              <Text style={{ fontSize: 12, color: t.ink3, marginTop: 3 }} numberOfLines={2}>
                {activeFiles.length} active funding files · {QC_FMT.short(fileValue)} in motion · {relationshipCount} relationships
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderRadius: 12, padding: 4, alignSelf: "stretch", borderWidth: 1, borderColor: t.line }}>
          {(["files", "leads"] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9,
                  backgroundColor: active ? t.surface : "transparent",
                  borderWidth: active ? 1 : 0,
                  borderColor: active ? t.line : "transparent",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? t.ink : t.ink3 }}>
                  {m === "files" ? "Funding files" : "Relationships"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 18, paddingBottom: 104 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {mode === "files"
          ? DEAL_STAGES.map((s) => {
              const items = dealGroups.get(s.value) ?? [];
              return (
                <View key={s.value} style={{ gap: 8 }}>
                  <StageHeader label={s.label} count={items.length} />
                  {items.length === 0 ? (
                    <EmptyStage text="No funding files here yet." />
                  ) : items.map((l) => {
                    const c = clientById.get(l.client_id);
                    return (
                      <LoanFileRow
                        key={l.id}
                        clientName={c?.name}
                        address={l.address || "Subject property"}
                        amount={Number(l.amount || 0)}
                        health={l.deal_health ?? null}
                        stageIndex={STAGE_INDEX.get(l.stage) ?? 0}
                        onPress={() => router.push(`/agent/loan/${l.id}` as Href)}
                      />
                    );
                  })}
                </View>
              );
            })
          : RELATIONSHIP_STAGES.map((s) => {
              const items = leadGroups.get(s.value) ?? [];
              return (
                <View key={s.value} style={{ gap: 8 }}>
                  <StageHeader label={s.label} count={items.length} />
                  {items.length === 0 ? (
                    <EmptyStage text="No relationships in this stage." />
                  ) : items.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => router.push(`/agent/client/${c.id}` as Href)}
                      style={({ pressed }) => ({
                        backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, padding: 14,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.client_type === "seller" ? t.warnBg : t.petrolSoft, alignItems: "center", justifyContent: "center" }}>
                          <Icon name={c.client_type === "seller" ? "building" : "user"} size={16} color={c.client_type === "seller" ? t.warn : t.petrol} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink, flex: 1 }} numberOfLines={1}>{c.name}</Text>
                            <Pill bg={c.client_type === "seller" ? t.warnBg : t.brandSoft} color={c.client_type === "seller" ? t.warn : t.brand}>
                              {c.client_type === "seller" ? "Seller" : "Buyer"}
                            </Pill>
                          </View>
                          {c.city ? <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }} numberOfLines={1}>{c.city}</Text> : null}
                          <Text style={{ fontSize: 12, color: t.ink2, marginTop: 9, lineHeight: 17 }} numberOfLines={2}>
                            {relationshipNextMove(c, c._stage)}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            <Pill bg={t.chip} color={t.ink2}>FICO {c.fico ?? "new"}</Pill>
                            <Pill bg={c._activeFiles ? t.brandSoft : t.surface2} color={c._activeFiles ? t.brand : t.ink3}>
                              {c._activeFiles ? `${c._activeFiles} funding file${c._activeFiles === 1 ? "" : "s"}` : "Agent file"}
                            </Pill>
                          </View>
                        </View>
                        <Icon name="chevR" size={14} color={t.ink4} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/agent/client/new" as Href)}
        accessibilityLabel="New client relationship"
        style={({ pressed }) => ({
          position: "absolute", right: 18, bottom: 20 + insets.bottom,
          backgroundColor: t.brand,
          paddingVertical: 13, paddingHorizontal: 18,
          borderRadius: 999,
          flexDirection: "row", alignItems: "center", gap: 6,
          shadowColor: "#0B1629", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name="plus" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>New client</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function inferClientStage(client: Client, activeFiles: number): ClientStage {
  if (client.stage) return client.stage;
  if (client.funded_count > 0) return "funded";
  if (activeFiles > 0) return "processing";
  return "lead";
}

function relationshipNextMove(client: Client, stage: ClientStage) {
  const isSeller = client.client_type === "seller";
  if (isSeller) {
    if (stage === "lead") return "Confirm sell-side timeline, target net, and property facts.";
    if (stage === "contacted") return "Collect payoff, listing goals, and seller docs.";
    if (stage === "verified") return "Package seller context before funding handoff.";
    if (stage === "ready_for_lending") return "Track funding intake and keep seller updated.";
    if (stage === "processing") return "Coordinate offer, conditions, and close logistics.";
    return "Log outcome and schedule post-close follow-up.";
  }
  if (stage === "lead") return "Confirm buy box, budget, and purchase timeline.";
  if (stage === "contacted") return "Send intake, soft-pull consent, and document request.";
  if (stage === "verified") return "Review readiness before funding handoff.";
  if (stage === "ready_for_lending") return "Monitor funding criteria review.";
  if (stage === "processing") return "Help borrower clear conditions and deadlines.";
  return "Capture next purchase goal and referral opportunity.";
}

function StageHeader({ label, count }: { label: string; count: number }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: t.ink3, textTransform: "uppercase" }}>{label}</Text>
      <Pill bg={t.chip} color={t.ink2}>{count}</Pill>
    </View>
  );
}

function EmptyStage({ text }: { text: string }) {
  const { t } = useTheme();
  return (
    <Card pad={14} style={{ borderRadius: 14 }}>
      <Text style={{ fontSize: 12, color: t.ink3 }}>{text}</Text>
    </Card>
  );
}

function LoanFileRow({
  clientName,
  address,
  amount,
  health,
  stageIndex,
  onPress,
}: {
  clientName?: string;
  address: string;
  amount: number;
  health: Loan["deal_health"];
  stageIndex: number;
  onPress: () => void;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        opacity: pressed ? 0.85 : 1,
        shadowColor: "#0B1629",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
          <Icon name="file" size={17} color={t.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {clientName ? (
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.4 }} numberOfLines={1}>
              {clientName}
            </Text>
          ) : null}
          <Text style={{ fontSize: 15, fontWeight: "800", color: t.ink, marginTop: clientName ? 2 : 0 }} numberOfLines={1}>
            {address}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>{QC_FMT.short(amount)}</Text>
            <DealHealthPill health={health} />
            <StageBadge stage={stageIndex} />
          </View>
        </View>
        <Icon name="chevR" size={14} color={t.ink4} />
      </View>
    </Pressable>
  );
}
