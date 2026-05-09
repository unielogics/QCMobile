import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Avatar, Card, Pill, SectionLabel } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { LoanSnapshotCard } from "@/components/LoanSnapshotCard";
import { DocumentRequestList } from "@/components/DocumentRequestList";
import { RealtorReadinessCard } from "@/components/RealtorReadinessCard";
import { ClientAIPlanCard } from "@/components/ClientAIPlanCard";
import { useClient, useDocuments, useEngagement, useFindOrCreateChatThread, useLoans, useRequestPrequalification, useStartFunding, useUpdateClientStage } from "@/hooks/useApi";
import { ClientStageOptions } from "@/lib/enums.generated";
import type { ClientStage } from "@/lib/enums.generated";

const STAGE_LABEL: Record<ClientStage, string> = Object.fromEntries(
  ClientStageOptions.map((o) => [o.value, o.label])
) as Record<ClientStage, string>;

export default function AgentClientRoute() {
  const { t } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: client } = useClient(id);
  const { data: loans = [] } = useLoans("mine");
  const { data: engagement = [] } = useEngagement(id);
  const updateStage = useUpdateClientStage();
  const startFunding = useStartFunding();
  const requestPrequal = useRequestPrequalification();
  const findOrCreate = useFindOrCreateChatThread();
  const [busy, setBusy] = useState<string | null>(null);

  const clientLoans = useMemo(() => loans.filter((l) => l.client_id === id), [loans, id]);
  const activeLoan = useMemo(() => clientLoans.find((l) => l.stage !== "funded") ?? clientLoans[0] ?? null, [clientLoans]);
  const { data: docs = [] } = useDocuments(activeLoan?.id);
  const pendingDocs = docs.filter((d) => d.status === "requested" || d.status === "pending" || d.status === "flagged");

  if (!client) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: t.ink3 }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = client.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const onCall = async () => {
    if (!client.phone) {
      Alert.alert("No phone on file", "Add a phone number in the borrower's profile first.");
      return;
    }
    Linking.openURL(`tel:${client.phone}`).catch(() => Alert.alert("Couldn't open dialer"));
  };

  const onMessage = async () => {
    setBusy("message");
    try {
      const thread = await findOrCreate.mutateAsync({ loan_id: activeLoan?.id ?? null });
      router.push(`/agent/messages/${thread.id}` as Href);
    } catch {
      Alert.alert("Couldn't open the message thread");
    } finally {
      setBusy(null);
    }
  };

  const onMarkContacted = async () => {
    setBusy("contacted");
    try {
      await updateStage.mutateAsync({ clientId: client.id, stage: "contacted" });
    } catch {
      Alert.alert("Couldn't update stage");
    } finally {
      setBusy(null);
    }
  };

  const onRequestDocs = () => {
    if (!activeLoan) {
      Alert.alert("No active loan", "Start funding first to open a doc request.");
      return;
    }
    Alert.alert("Request docs", "The doc-request sheet ships with the next backend update. Until then, message the borrower with the list directly.");
  };

  // Agent's controlled handoff to the funding team (alembic 0031).
  // Backend builds the Lending Handoff Packet, creates a PrequalRequest,
  // spawns the lending AI thread with the first memory-aware message,
  // and drops an AITask in the funding queue. Two-step UX:
  //
  //   1. Confirm Alert — "Ready to send X to lending? The AI will…"
  //   2. After fire — success Alert with the handoff summary + the
  //      first question the Lending AI asked.
  const onRequestPrequal = () => {
    Alert.alert(
      `Ready to send ${client.name} to lending?`,
      "The AI will:\n\n" +
        "• Summarize the realtor conversation\n" +
        "• Carry over relevant facts and files\n" +
        "• Identify missing lending items\n" +
        "• Create a prequal quote in the funding queue\n" +
        "• Spawn a lending AI thread that already knows everything",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send to Lending",
          style: "default",
          onPress: async () => {
            setBusy("prequal");
            try {
              const result = await requestPrequal.mutateAsync(client.id);
              const summary = result.handoff_summary
                ? `\n\nKnown from realtor side:\n${result.handoff_summary}`
                : "";
              const missing =
                result.missing_lending_items && result.missing_lending_items.length > 0
                  ? `\n\nLending AI will collect:\n• ${result.missing_lending_items.join("\n• ")}`
                  : "";
              const firstQ = result.first_lending_question
                ? `\n\nFirst question the AI asked:\n${result.first_lending_question}`
                : "";
              Alert.alert(
                `${client.name} moved to Lending Intake`,
                "Funding team has been notified. The Lending AI started a fresh thread and already knows the context." +
                  summary +
                  missing +
                  firstQ,
              );
            } catch (e) {
              Alert.alert(
                "Couldn't hand off",
                e instanceof Error ? e.message : "Try again in a minute.",
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const onStartFunding = () => {
    Alert.alert(
      "Start funding?",
      "This marks the prequal approved, creates the loan, and hands off to the Funding Team.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start funding",
          style: "default",
          onPress: async () => {
            setBusy("funding");
            try {
              await startFunding.mutateAsync(client.id);
            } catch {
              Alert.alert("Couldn't start funding");
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="x" size={18} color={t.ink} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink, flex: 1 }}>Client</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}>
        <Card pad={18}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar label={initials} color={client.avatar_color ?? undefined} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink }}>{client.name}</Text>
              <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }} numberOfLines={1}>
                {[client.email, client.phone, client.city].filter(Boolean).join(" · ") || "No contact info"}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                {client.stage ? <Pill bg={t.brandSoft} color={t.brand}>{STAGE_LABEL[client.stage]}</Pill> : null}
                {client.client_type ? (
                  <Pill bg={t.chip} color={t.ink2}>
                    {client.client_type === "buyer" ? "Buyer" : "Seller"}
                  </Pill>
                ) : null}
              </View>
            </View>
          </View>
        </Card>

        {/* Active AI Plan card (alembic 0032). Trumps the legacy
            missing_facts walk; renders the playbook-resolved active
            list for THIS client + lets the agent set per-client
            custom instructions for the AI. */}
        <ClientAIPlanCard clientId={client.id} loanId={null} />

        {/* Realtor Client Intelligence Profile (alembic 0030). Renders
            when the Realtor AI has captured at least the client_type
            during a conversation. Mirrors the desktop card. */}
        {client.realtor_profile && client.realtor_profile.client_type !== "unknown" ? (
          <RealtorReadinessCard profile={client.realtor_profile} />
        ) : null}

        {clientLoans.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Active loans</SectionLabel>
            {clientLoans.map((l) => (
              <LoanSnapshotCard key={l.id} loan={l} onPress={() => router.push(`/agent/loan/${l.id}` as Href)} />
            ))}
          </View>
        ) : null}

        {activeLoan ? (
          <View>
            <SectionLabel>Documents</SectionLabel>
            <DocumentRequestList documents={docs} onSelect={() => router.push(`/agent/loan/${activeLoan.id}` as Href)} />
          </View>
        ) : null}

        <View>
          <SectionLabel>Recent activity</SectionLabel>
          {engagement.length === 0 ? (
            <Card pad={18}>
              <Text style={{ fontSize: 13, color: t.ink3 }}>No recorded activity yet.</Text>
            </Card>
          ) : (
            <Card pad={14}>
              {engagement.slice(0, 8).map((e, i, arr) => (
                <View
                  key={e.id}
                  style={{ paddingVertical: 8, borderBottomColor: t.line, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }}
                >
                  <Text style={{ fontSize: 12, color: t.ink, fontWeight: "600" }}>{e.signal_type.replace(/_/g, " ")}</Text>
                  <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{new Date(e.occurred_at).toLocaleString()}</Text>
                </View>
              ))}
            </Card>
          )}
        </View>

        {pendingDocs.length > 0 ? (
          <Card pad={14}>
            <Text style={{ fontSize: 12, color: t.ink2 }}>
              {pendingDocs.length} document{pendingDocs.length === 1 ? "" : "s"} still needed.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 22, backgroundColor: t.surface, borderTopColor: t.line, borderTopWidth: 1 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton label="Call" icon="bolt" onPress={onCall} disabled={!client.phone} />
          <ActionButton label="Message" icon="chat" onPress={onMessage} loading={busy === "message"} />
          {client.stage === "lead" ? (
            <ActionButton label="Contacted" icon="check" onPress={onMarkContacted} loading={busy === "contacted"} />
          ) : null}
          {/* Lead-stage handoff to funding team. Hidden once already
              requested so the agent doesn't double-fire. The desktop
              shows a "Funding review requested" pill in the same
              state — mobile keeps it simpler by hiding the button. */}
          {client.stage === "lead" && client.lead_promotion_status !== "agent_requested_review" ? (
            <ActionButton
              label="Ready for lending"
              icon="bolt"
              primary
              onPress={onRequestPrequal}
              loading={busy === "prequal"}
            />
          ) : null}
          {client.stage === "verified" ? (
            <ActionButton label="Start funding" icon="bolt" primary onPress={onStartFunding} loading={busy === "funding"} />
          ) : null}
          {activeLoan ? (
            <ActionButton label="Docs" icon="vault" onPress={onRequestDocs} />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({
  label, icon, onPress, primary, loading, disabled,
}: {
  label: string;
  icon: "bolt" | "chat" | "check" | "vault";
  onPress: () => void;
  primary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTheme();
  const bg = primary ? t.brand : t.surface2;
  const fg = primary ? "#fff" : t.ink;
  const borderColor = primary ? t.brand : t.line;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 11, paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: bg, borderColor, borderWidth: 1,
        alignItems: "center", gap: 4, flexDirection: "row", justifyContent: "center",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={14} color={fg} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: fg }}>{label}</Text>
    </Pressable>
  );
}

