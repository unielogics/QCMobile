import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Avatar, Card, Pill, SectionLabel } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { LoanSnapshotCard } from "@/components/LoanSnapshotCard";
import { DocumentRequestList } from "@/components/DocumentRequestList";
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

  // Agent's controlled handoff to the funding team. Backend creates a
  // PrequalRequest from Client.lead_intake JSONB + spawns an AITask in
  // the funding-team queue. Borrower-side path doesn't change.
  const onRequestPrequal = () => {
    Alert.alert(
      "Hand off to the funding team?",
      "We'll create a prequalification quote from this lead's data and notify the funding team. They'll review and convert it to a loan when ready.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send for review",
          style: "default",
          onPress: async () => {
            setBusy("prequal");
            try {
              await requestPrequal.mutateAsync(client.id);
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
              label="Ready for prequal"
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

