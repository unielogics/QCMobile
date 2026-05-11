import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, SectionLabel } from "@/design-system/primitives";
import { Icon, type IconName } from "@/design-system/Icon";
import { DocumentRequestList } from "@/components/DocumentRequestList";
import { DealHealthPill } from "@/components/agent/DealHealthPill";
import { AIPromptPicker } from "@/components/agent/AIPromptPicker";
import { QC_FMT } from "@/design-system/tokens";
import {
  useAIChatThread,
  useDocuments,
  useFindOrCreateChatThread,
  useLoan,
  useLoanActivity,
  useSendAIChatMessage,
} from "@/hooks/useApi";
import { LoanStageOptions, type LoanStage } from "@/lib/enums.generated";
import type { Activity, Document, Loan } from "@/lib/types";

type Tab = "snapshot" | "docs" | "activity" | "messages";

const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: "snapshot", label: "Snapshot", icon: "file" },
  { value: "docs",     label: "Docs",     icon: "vault" },
  { value: "activity", label: "Activity", icon: "audit" },
  { value: "messages", label: "Messages", icon: "chat" },
];

// Height the body content needs to clear so the sticky bottom tab
// bar doesn't cover it. Tab bar is roughly 64px tall + safe-area
// inset, so 88 + inset gives a comfortable buffer.
const BOTTOM_BAR_PAD = 88;

const STAGE_LABEL: Record<LoanStage, string> = Object.fromEntries(
  LoanStageOptions.map((o) => [o.value, o.label])
) as Record<LoanStage, string>;

export default function AgentLoanRoute() {
  const { t } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = BOTTOM_BAR_PAD + insets.bottom;
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

      {tab === "snapshot" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad }}>
          <AgentFundingMirror loan={loan} docs={docs} activity={activity} />
        </ScrollView>
      ) : tab === "docs" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad }}>
          <Card pad={16}>
            <SectionLabel>Client-visible conditions</SectionLabel>
            <Text style={{ fontSize: 13, color: t.ink3, lineHeight: 18 }}>
              Funding owns review and approval. Use this list to help your client gather open items.
            </Text>
          </Card>
          <DocumentRequestList documents={docs} />
        </ScrollView>
      ) : tab === "activity" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: bottomPad }}>
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
        <LoanThreadView loanId={loan.id} bottomPad={bottomPad} />
      ) : null}

      {/* Sticky bottom tab bar — same anchoring style as the Client
          page's bottom action bar (position: absolute, surface bg,
          top border, soft shadow, safe-area-aware bottom padding). */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          paddingHorizontal: 6,
          backgroundColor: t.surface,
          borderTopColor: t.line,
          borderTopWidth: 1,
          shadowColor: "#0B1629",
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        }}
      >
        {TABS.map((tt) => {
          const active = tab === tt.value;
          return (
            <Pressable
              key={tt.value}
              onPress={() => setTab(tt.value)}
              accessibilityLabel={tt.label}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 8,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                backgroundColor: active ? t.brandSoft : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name={tt.icon} size={20} color={active ? t.brand : t.ink3} />
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: "800",
                  color: active ? t.brand : t.ink3,
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                {tt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function AgentFundingMirror({ loan, docs, activity }: { loan: Loan; docs: Document[]; activity: Activity[] }) {
  const { t } = useTheme();
  const receivedDocs = docs.filter((d) => d.status === "received" || d.status === "verified").length;
  const openDocs = docs.filter((d) => d.status !== "verified").length;
  const closeStr = loan.close_date
    ? new Date(loan.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "Unset";

  return (
    <>
      <Card pad={18}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="file" size={19} color={t.brand} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SectionLabel>Agent funding mirror</SectionLabel>
            <Text style={{ fontSize: 18, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }} numberOfLines={2}>
              {loan.address || "Subject property"}
            </Text>
            <Text style={{ fontSize: 12, color: t.ink3, marginTop: 4, lineHeight: 17 }}>
              Funding criteria and underwriting stay internal. This view keeps client coordination visible.
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MirrorStat label="Amount" value={QC_FMT.short(Number(loan.amount || 0))} />
        <MirrorStat label="Docs" value={`${receivedDocs}/${docs.length || 0}`} />
        <MirrorStat label="Close" value={closeStr} />
      </View>

      <Card pad={16}>
        <SectionLabel>Status</SectionLabel>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Pill bg={t.brandSoft} color={t.brand}>{STAGE_LABEL[loan.stage]}</Pill>
          <Pill bg={openDocs ? t.warnBg : t.profitBg} color={openDocs ? t.warn : t.profit}>
            {openDocs ? `${openDocs} open item${openDocs === 1 ? "" : "s"}` : "Docs clear"}
          </Pill>
          <DealHealthPill health={loan.deal_health ?? null} />
        </View>
        <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19, marginTop: 12 }}>
          {openDocs
            ? "Help the client gather open documents and keep transaction parties aligned."
            : "Keep the client updated while funding moves the file through lender milestones."}
        </Text>
      </Card>

      <Card pad={16}>
        <SectionLabel>Recent funding updates</SectionLabel>
        {activity.length === 0 ? (
          <Text style={{ fontSize: 13, color: t.ink3 }}>No recent updates yet.</Text>
        ) : (
          activity.slice(0, 4).map((a, i, arr) => (
            <View key={a.id} style={{ paddingVertical: 8, borderBottomColor: t.line, borderBottomWidth: i < arr.length - 1 ? 1 : 0 }}>
              <Text style={{ fontSize: 12.5, color: t.ink, fontWeight: "700" }} numberOfLines={2}>{a.summary}</Text>
              <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{new Date(a.occurred_at).toLocaleString()}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function MirrorStat({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <Card pad={12} style={{ flex: 1, borderRadius: 14 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: "800", color: t.ink, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{value}</Text>
    </Card>
  );
}

function LoanThreadView({ loanId, bottomPad }: { loanId: string; bottomPad: number }) {
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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad }}>
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
