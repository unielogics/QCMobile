import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Stepper, StepperLabels } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { Slider } from "@/design-system/Slider";
import { QC_FMT } from "@/design-system/tokens";
import {
  useLoan,
  useLoanActivity,
  useDocuments,
  useLoanChat,
  useLoanWorkspace,
  useSendLoanChat,
} from "@/hooks/useApi";
import type { Document } from "@/lib/types";
import { LoanSimulator } from "@/components/LoanSimulator";
import { LoanChatThread } from "@/components/loan/LoanChatThread";
import { PauseBanner } from "@/components/loan/PauseBanner";
import { KeyboardAware } from "@/components/KeyboardAware";

const STAGE_KEYS = ["prequalified", "collecting_docs", "lender_connected", "processing", "closing", "funded"] as const;
const PIPELINE_STAGES = ["Prequalified", "Processing", "Underwriting", "Closing", "Funded"];
const TYPE_ICON: Record<string, string> = {
  fix_and_flip: "hammer",
  ground_up: "building2",
  dscr: "key",
  bridge: "bolt",
  portfolio: "layers",
  cash_out_refi: "refresh",
};
const TYPE_LABEL: Record<string, string> = {
  fix_and_flip: "Fix & Flip",
  ground_up: "Ground Up",
  dscr: "DSCR",
  bridge: "Bridge",
  portfolio: "Portfolio",
  cash_out_refi: "Cash-Out",
};

const TABS = [
  { id: "activity", label: "Activity",   icon: "flag" },
  { id: "chat",     label: "AI Chat",    icon: "chat" },
  { id: "docs",     label: "Documents",  icon: "doc" },
  { id: "sim",      label: "Simulation", icon: "sliders" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function LoanFile() {
  const { t, isDark } = useTheme();
  const router = useRouter();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { data: loan } = useLoan(id);
  const initialTab: TabId = (TABS.find((t) => t.id === tabParam)?.id ?? "activity") as TabId;
  const [tab, setTab] = useState<TabId>(initialTab);

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
        <Text style={{ color: t.ink3 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const stageIdx = Math.max(0, STAGE_KEYS.indexOf(loan.stage));
  const stagePos = Math.min(4, Math.floor((stageIdx / (STAGE_KEYS.length - 1)) * 4));
  const typeLabel = TYPE_LABEL[loan.type] ?? loan.type.replace("_", " ");
  const iconName = TYPE_ICON[loan.type] ?? "doc";
  const closeStr = loan.close_date
    ? new Date(loan.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            alignSelf: "flex-start",
            flexDirection: "row", alignItems: "center", gap: 4,
            paddingVertical: 6, paddingHorizontal: 10,
            borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line,
          }}
        >
          <Icon name="arrowL" size={14} color={t.ink2} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: t.ink2 }}>Pipeline</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card pad={16}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name={iconName} size={22} color={t.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: t.ink, letterSpacing: -0.3 }}>{loan.address}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>
                {loan.city ?? "—"} · {typeLabel} · {loan.deal_id}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: t.ink, letterSpacing: -0.4 }}>{QC_FMT.short(Number(loan.amount))}</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3, fontWeight: "600" }}>Close {closeStr}</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Stepper stages={PIPELINE_STAGES} current={stagePos} />
            <StepperLabels stages={PIPELINE_STAGES} current={stagePos} />
          </View>
        </Card>
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: t.chip, borderRadius: 12, padding: 3 }}>
          {TABS.map((opt) => {
            const active = tab === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setTab(opt.id)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 9,
                  backgroundColor: active ? t.surface : "transparent",
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <Icon name={opt.icon} size={13} color={active ? t.ink : t.ink3} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.ink : t.ink3 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === "activity" && <ActivityPane loanId={loan.id} />}
      {tab === "chat" && <ChatPane loanId={loan.id} dealId={loan.deal_id} />}
      {tab === "docs" && <DocsPane loanId={loan.id} />}
      {tab === "sim" && <LoanSimulator loan={loan} />}
    </SafeAreaView>
  );
}

function ActivityPane({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data: activity = [], isLoading } = useLoanActivity(loanId);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
      {isLoading ? <Text style={{ color: t.ink3, fontSize: 13 }}>Loading activity…</Text> : null}
      {!isLoading && activity.length === 0 ? (
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>No activity yet for this loan.</Text>
        </Card>
      ) : null}
      {activity.map((e) => (
        <Card key={e.id} pad={14}>
          <Text style={{ fontSize: 11, color: t.ink3, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) }}>
            {new Date(e.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </Text>
          <Text style={{ fontSize: 14, color: t.ink, fontWeight: "600", marginTop: 4 }}>{e.summary}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.chip }}>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: t.ink2 }}>{e.kind}</Text>
            </View>
            {e.actor_label ? <Text style={{ fontSize: 11, color: t.ink3 }}>{e.actor_label}</Text> : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

// Borrower's view of the loan chat. CRITICAL: this MUST read from
// /loans/{id}/chat (the workspace thread) — the same surface the
// broker writes to via Live Chat and the same one super_admin uses
// for operator takeover. Previously this pane talked to /ai/chat
// (a per-user one-shot AI thread), which meant broker Live-Chat
// messages were persisted in loan_chat_messages but the borrower
// never saw them. Wiring both sides to the workspace chat is the
// fix that makes operator-takeover actually reach the customer.
function ChatPane({ loanId, dealId }: { loanId: string; dealId: string }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: chat = [] } = useLoanChat(loanId);
  // Workspace is queried separately so the PauseBanner stays in sync
  // even when the loan tab isn't open.
  useLoanWorkspace(loanId);
  const send = useSendLoanChat();
  const [draft, setDraft] = useState("");

  const onSend = async () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    setDraft("");
    try {
      // CLIENT can only send mode=chat per backend _MODE_ALLOWED_ROLES.
      // Backend auto-replies with AI unless the loan is paused — in
      // which case the message is persisted and the AI stays quiet,
      // letting the broker/operator reply directly.
      await send.mutateAsync({ loanId, body: text, mode: "chat" });
    } catch (err) {
      // Restore the draft so the user can retry.
      setDraft(text);
    }
  };

  return (
    <KeyboardAware excludeTabBar>
      {/* Sticky deal-id strip so the borrower always knows which loan
          this thread is for, even after they've scrolled the messages. */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          paddingHorizontal: 16, paddingVertical: 8,
          borderBottomColor: t.line, borderBottomWidth: 1,
          backgroundColor: t.surface,
        }}
      >
        <View
          style={{
            paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: 6, backgroundColor: t.petrolSoft,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: t.petrol }}>
            {dealId}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: t.ink2, flex: 1 }} numberOfLines={1}>
          Loan chat thread
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
        <PauseBanner
          loanId={loanId}
          message="Your operator is replying directly. The AI will resume shortly."
        />
      </View>
      {chat.length === 0 ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Card pad={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon name="spark" size={14} color={t.petrol} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: t.petrol, letterSpacing: 1.2, textTransform: "uppercase" }}>
                Loan chat · {dealId}
              </Text>
            </View>
            <Text style={{ color: t.ink3, fontSize: 13, lineHeight: 18 }}>
              Ask anything about your loan — pricing, missing docs, next steps. Your agent and the AI are on this thread together.
            </Text>
          </Card>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <LoanChatThread messages={chat} viewerRole="client" />
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 8,
          // Reserve the system-bar inset so the send button doesn't
          // sit behind the Android nav bar / iOS home indicator.
          paddingBottom: Math.max(8, insets.bottom + 4),
          borderTopWidth: 1,
          borderTopColor: t.line,
          backgroundColor: t.surface,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about this loan…"
          placeholderTextColor={t.ink3}
          multiline
          editable={!send.isPending}
          style={{
            flex: 1, fontSize: 14, color: t.ink,
            backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line,
            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120,
          }}
        />
        <Pressable
          onPress={onSend}
          disabled={send.isPending || !draft.trim()}
          accessibilityLabel="Send"
          style={({ pressed }) => ({
            paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
            backgroundColor: send.isPending || !draft.trim() ? t.chip : t.ink,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {send.isPending ? (
            <ActivityIndicator color={t.inverse} size="small" />
          ) : (
            <Icon name="send" size={16} color={!draft.trim() ? t.ink4 : t.inverse} />
          )}
        </Pressable>
      </View>
    </KeyboardAware>
  );
}

function DocsPane({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data: docs = [], isLoading } = useDocuments(loanId);

  const counts = useMemo(() => ({
    received:  docs.filter((d) => d.status === "received" || d.status === "verified").length,
    requested: docs.filter((d) => d.status === "requested").length,
    pending:   docs.filter((d) => d.status === "pending").length,
    flagged:   docs.filter((d) => d.status === "flagged").length,
  }), [docs]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
      <Card pad={14}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.6, textTransform: "uppercase" }}>
            Document Vault · {docs.length} items
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <Counter label="Received" count={counts.received} color={t.profit} />
          <Counter label="Requested" count={counts.requested} color={t.brand} />
          <Counter label="Pending" count={counts.pending} color={t.warn} />
          <Counter label="Flagged" count={counts.flagged} color={t.danger} />
        </View>
      </Card>
      {isLoading ? <Text style={{ color: t.ink3, fontSize: 13 }}>Loading documents…</Text> : null}
      {!isLoading && docs.length === 0 ? (
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>No documents on file yet.</Text>
        </Card>
      ) : null}
      {docs.map((d) => <DocRow key={d.id} doc={d} />)}
    </ScrollView>
  );
}

function DocRow({ doc }: { doc: Document }) {
  const { t } = useTheme();
  const statusBg = doc.status === "verified" ? t.profitBg : doc.status === "received" ? t.brandSoft : doc.status === "flagged" ? t.dangerBg : t.warnBg;
  const statusFg = doc.status === "verified" ? t.profit : doc.status === "received" ? t.brand : doc.status === "flagged" ? t.danger : t.warn;
  return (
    <Card pad={12}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="doc" size={16} color={t.ink3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{doc.name}</Text>
          <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
            {doc.category ?? "uncategorized"}
            {doc.requested_on ? ` · requested ${new Date(doc.requested_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            {doc.received_on ? ` · received ${new Date(doc.received_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </Text>
        </View>
        <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: statusBg }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", color: statusFg, textTransform: "uppercase", letterSpacing: 0.4 }}>{doc.status}</Text>
        </View>
      </View>
    </Card>
  );
}

function Counter({ label, count, color }: { label: string; count: number; color: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: t.ink3, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }}>{count}</Text>
    </View>
  );
}

