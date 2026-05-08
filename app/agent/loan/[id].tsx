import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, SectionLabel } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { LoanSnapshotCard } from "@/components/LoanSnapshotCard";
import { DocumentRequestList } from "@/components/DocumentRequestList";
import { DealHealthPill } from "@/components/agent/DealHealthPill";
import { AIPromptPicker } from "@/components/agent/AIPromptPicker";
import {
  useAIChatThread,
  useDocuments,
  useFindOrCreateChatThread,
  useLoan,
  useLoanActivity,
  useSendAIChatMessage,
} from "@/hooks/useApi";

type Tab = "snapshot" | "docs" | "activity" | "messages" | "ai";

const TABS: { value: Tab; label: string }[] = [
  { value: "snapshot", label: "Snapshot" },
  { value: "docs", label: "Docs" },
  { value: "activity", label: "Activity" },
  { value: "messages", label: "Messages" },
  { value: "ai", label: "AI" },
];

export default function AgentLoanRoute() {
  const { t } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("snapshot");

  const { data: loan } = useLoan(id);
  const { data: docs = [] } = useDocuments(id);
  const { data: activity = [] } = useLoanActivity(id);

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: t.ink3 }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="x" size={18} color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }} numberOfLines={1}>
            {loan.address || "Subject property"}
          </Text>
          <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{loan.deal_id}</Text>
        </View>
        <DealHealthPill health={loan.deal_health ?? null} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}
      >
        {TABS.map((tt) => {
          const active = tab === tt.value;
          return (
            <Pressable
              key={tt.value}
              onPress={() => setTab(tt.value)}
              style={({ pressed }) => ({
                paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999,
                backgroundColor: active ? t.brand : t.surface2,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : t.ink }}>{tt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === "snapshot" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <LoanSnapshotCard loan={loan} />
        </ScrollView>
      ) : tab === "docs" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <DocumentRequestList documents={docs} />
        </ScrollView>
      ) : tab === "activity" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {activity.length === 0 ? (
            <Card pad={18}>
              <Text style={{ fontSize: 13, color: t.ink3 }}>No activity recorded yet.</Text>
            </Card>
          ) : (
            <Card pad={14}>
              {activity.map((a, i, arr) => (
                <View
                  key={a.id}
                  style={{ paddingVertical: 8, borderBottomColor: t.line, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }}
                >
                  <Text style={{ fontSize: 12, color: t.ink, fontWeight: "600" }} numberOfLines={2}>{a.summary}</Text>
                  <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{new Date(a.occurred_at).toLocaleString()}</Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      ) : tab === "messages" ? (
        <LoanThreadView loanId={loan.id} />
      ) : (
        <LoanAIView loanId={loan.id} />
      )}
    </SafeAreaView>
  );
}

function LoanThreadView({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const router = useRouter();
  const findOrCreate = useFindOrCreateChatThread();
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    findOrCreate.mutateAsync({ loan_id: loanId }).then((th) => {
      if (!cancelled) setThreadId(th.id);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const { data: thread } = useAIChatThread(threadId);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      {!thread ? (
        <Card pad={18}><Text style={{ fontSize: 13, color: t.ink3 }}>Opening conversation…</Text></Card>
      ) : (
        <>
          {(thread.messages ?? []).slice(-6).map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: m.role === "user" ? t.brand : t.surface,
                borderColor: t.line, borderWidth: m.role === "user" ? 0 : 1,
                borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: m.role === "user" ? "#fff" : t.ink, fontSize: 14, lineHeight: 19 }}>{m.body}</Text>
            </View>
          ))}
          {threadId ? (
            <Pressable
              onPress={() => router.push(`/agent/messages/${threadId}` as Href)}
              style={({ pressed }) => ({
                backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1,
                borderRadius: 10, padding: 14, alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>Open full thread</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function LoanAIView({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const findOrCreate = useFindOrCreateChatThread();
  const send = useSendAIChatMessage();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    findOrCreate.mutateAsync({ loan_id: loanId }).then((th) => {
      if (!cancelled) setThreadId(th.id);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  const { data: thread } = useAIChatThread(threadId);

  const handleSend = async (body?: string) => {
    const text = (body ?? draft).trim();
    if (!text || !threadId) return;
    setDraft("");
    try {
      await send.mutateAsync({ threadId, body: text, loan_id: loanId });
    } catch {
      Alert.alert("Couldn't send to the AI");
      setDraft(text);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
      <AIPromptPicker onPick={(p) => handleSend(p)} />

      {!thread ? (
        <Card pad={18}><Text style={{ fontSize: 13, color: t.ink3 }}>Opening AI thread…</Text></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {(thread.messages ?? []).slice(-4).map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: m.role === "user" ? t.brand : t.surface,
                borderColor: t.line, borderWidth: m.role === "user" ? 0 : 1,
                borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: m.role === "user" ? "#fff" : t.ink, fontSize: 14, lineHeight: 19 }}>{m.body}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask anything about this deal…"
          placeholderTextColor={t.ink4}
          multiline
          style={{
            flex: 1, color: t.ink, fontSize: 14,
            backgroundColor: t.surface2, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, minHeight: 38, maxHeight: 120,
            borderColor: t.line, borderWidth: 1,
          }}
        />
        <Pressable
          onPress={() => handleSend()}
          disabled={!draft.trim() || send.isPending}
          style={({ pressed }) => ({
            backgroundColor: t.brand,
            paddingHorizontal: 14, borderRadius: 10,
            alignItems: "center", justifyContent: "center",
            opacity: !draft.trim() || send.isPending ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </ScrollView>
  );
}
