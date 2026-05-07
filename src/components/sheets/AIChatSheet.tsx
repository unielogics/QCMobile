// AI Intelligent Underwriter chat sheet (mobile).
//
// Default landing surface = the conversations LIST. The list is
// DERIVED, not raw — exactly one Account thread row + one row per
// loan the user has, so we can never show duplicates regardless of
// what the DB has. Threads lazy-create on first tap via the
// /ai/chat/threads/find-or-create endpoint (canonical guarantee:
// alembic 0017 partial unique idx on (user, loan), 0018 partial
// unique idx on (user) WHERE loan_id IS NULL).
//
// Caller paths:
//   FAB (Dashboard / Calendar)     no initialThreadId → list view
//   Loan detail / pipeline          initialThreadId set → chat view
//
// Touch handling matches the rest of the app: `transparent` Modal,
// no SafeAreaView nested inside (it swallows touches on Android).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";
import {
  useAIChatThread,
  useAIChatThreads,
  useFindOrCreateChatThread,
  useLoans,
  useSendAIChatMessage,
} from "@/hooks/useApi";
import type { AIChatThread, Loan } from "@/lib/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  // Optional sub-title — caller can hint context, e.g. "From your dashboard".
  context?: string;
  // When set, the sheet opens directly into this thread (used from
  // the loan detail page / pipeline). Not set → list view.
  initialThreadId?: string | null;
}

const STARTER_PROMPTS = [
  "What's the next thing I need to do?",
  "Are any of my docs overdue?",
  "What's blocking my deal from closing?",
  "Show me my current pipeline",
];

export function AIChatSheet({ visible, onClose, context, initialThreadId }: Props) {
  const { t } = useTheme();
  const { data: loans = [] } = useLoans();
  const { data: threads = [], isLoading: threadsLoading } = useAIChatThreads();
  const findOrCreate = useFindOrCreateChatThread();
  const sendMessage = useSendAIChatMessage();

  // When the caller controls the thread (initialThreadId set), we
  // jump straight into chat. When they don't, we land in the
  // conversations LIST.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId ?? null);
  const [showList, setShowList] = useState<boolean>(!initialThreadId);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const activeThreadQ = useAIChatThread(activeThreadId);
  const messages = activeThreadQ.data?.messages ?? [];

  // Derived list — exactly one Account row + one row per loan.
  // Threads in the DB that don't match (orphans, dupes pre-0018)
  // are ignored by this derived view, so the user only sees the
  // canonical set.
  const accountThread = useMemo<AIChatThread | undefined>(
    () => threads.find((th) => !th.loan_id),
    [threads],
  );
  const loanThreadMap = useMemo(() => {
    const map = new Map<string, AIChatThread>();
    for (const th of threads) {
      if (th.loan_id) map.set(th.loan_id, th);
    }
    return map;
  }, [threads]);

  // Sync prop → state. When the parent provides a thread, jump
  // into it. When the parent clears it (or never provides one),
  // reset to the list view so each fresh open lands on the list.
  useEffect(() => {
    if (initialThreadId) {
      setActiveThreadId(initialThreadId);
      setShowList(false);
    } else {
      setShowList(true);
    }
  }, [initialThreadId, visible]);

  // Auto-scroll the thread to the bottom when a new message lands or
  // the AI starts thinking.
  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, sendMessage.isPending]);

  const openThread = async (loan_id: string | null) => {
    setError(null);
    const existing = loan_id == null ? accountThread : loanThreadMap.get(loan_id);
    if (existing) {
      setActiveThreadId(existing.id);
      setShowList(false);
      return;
    }
    try {
      const created = await findOrCreate.mutateAsync({ loan_id });
      setActiveThreadId(created.id);
      setShowList(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the thread.");
    }
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sendMessage.isPending) return;
    setError(null);
    try {
      let threadId = activeThreadId;
      if (!threadId) {
        // Fall back to the canonical Account thread — find-or-create
        // (NOT plain create) so we never spawn a duplicate.
        const t = await findOrCreate.mutateAsync({ loan_id: null });
        threadId = t.id;
        setActiveThreadId(threadId);
      }
      await sendMessage.mutateAsync({ threadId, body: text });
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed to respond.");
    }
  };

  const activeTitle = activeThreadQ.data?.title;
  const activeSub = activeThreadQ.data?.loan_deal_id
    ? `${activeThreadQ.data.loan_deal_id}${activeThreadQ.data.loan_address ? ` · ${activeThreadQ.data.loan_address}` : ""}`
    : (context ?? "Cross-loan account context");

  return (
    <Modal
      // `transparent` (matching the rest of the app's sheets) so
      // touches route through the existing window on Android.
      // presentationStyle="fullScreen" + nested SafeAreaView would
      // re-create the previously-fixed swallow-touches bug.
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Header bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: t.line,
              backgroundColor: t.bg,
            }}
          >
            <Pressable
              onPress={() => {
                // In chat view (and the sheet WASN'T locked to a single
                // thread by initialThreadId) the left arrow goes back to
                // the conversations list. Otherwise it closes the sheet.
                if (!showList && !initialThreadId) {
                  setShowList(true);
                  return;
                }
                onClose();
              }}
              accessibilityLabel={!showList && !initialThreadId ? "Back to conversations" : "Close"}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 999,
                backgroundColor: pressed ? t.chip : "transparent",
                alignItems: "center", justifyContent: "center",
              })}
            >
              <Icon
                name={!showList && !initialThreadId ? "chevL" : "x"}
                size={18}
                color={t.ink2}
              />
            </Pressable>
            <View
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: t.petrolSoft,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="chat" size={16} color={t.petrol} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}
              >
                {showList ? "Conversations" : (activeTitle ?? "AI Intelligent Underwriter")}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}
              >
                {showList
                  ? `1 account thread · ${loans.length} loan${loans.length === 1 ? "" : "s"}`
                  : activeSub}
              </Text>
            </View>
          </View>

          {showList ? (
            <ScrollView
              style={{ flex: 1, backgroundColor: t.bg }}
              contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Account / general thread row — always present */}
              <ConversationRow
                t={t}
                title="Account questions"
                subtitle={accountThread?.last_message_preview ?? "General questions about your portfolio."}
                timestamp={accountThread?.last_message_at ?? null}
                accent="petrol"
                empty={!accountThread}
                isActive={!!accountThread && activeThreadId === accountThread.id}
                onPress={() => openThread(null)}
              />

              {loans.length > 0 ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: t.ink3,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                    marginTop: 14,
                    marginBottom: 4,
                  }}
                >
                  Loans
                </Text>
              ) : null}

              {loans.map((loan: Loan) => {
                const th = loanThreadMap.get(loan.id);
                return (
                  <ConversationRow
                    key={loan.id}
                    t={t}
                    title={loan.deal_id}
                    subtitleHeader={loan.address ?? ""}
                    subtitle={th?.last_message_preview ?? "No conversation yet — tap to start."}
                    timestamp={th?.last_message_at ?? null}
                    accent="brand"
                    empty={!th}
                    isActive={!!th && activeThreadId === th.id}
                    onPress={() => openThread(loan.id)}
                  />
                );
              })}

              {threadsLoading && threads.length === 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12 }}>
                  <ActivityIndicator size="small" color={t.ink3} />
                  <Text style={{ fontSize: 12, color: t.ink3 }}>Loading conversations…</Text>
                </View>
              ) : null}

              {error ? (
                <View style={{ padding: 10, borderRadius: 9, backgroundColor: t.dangerBg, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: t.danger }}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <>
              {/* Thread — fills all the space between header and composer */}
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: t.bg }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                {!activeThreadId || messages.length === 0 ? (
                  <View style={{ paddingTop: 8 }}>
                    <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 18, marginBottom: 14 }}>
                      Ask me about your pipeline, outstanding documents, what&apos;s
                      next on a deal, or anything else underwriting-related. I see
                      your full account context.
                    </Text>
                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
                      Try asking
                    </Text>
                    <View style={{ gap: 6 }}>
                      {STARTER_PROMPTS.map((p) => (
                        <Pressable
                          key={p}
                          onPress={() => send(p)}
                          style={({ pressed }) => ({
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: t.line,
                            backgroundColor: pressed ? t.surface2 : "transparent",
                          })}
                        >
                          <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18 }}>{p}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  messages.map((m) => (
                    <View
                      key={m.id}
                      style={{
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "86%",
                        padding: 11,
                        borderRadius: 14,
                        backgroundColor: m.role === "user" ? t.brandSoft : t.surface2,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        color: m.role === "user" ? t.brand : t.ink,
                        lineHeight: 18,
                      }}>
                        {m.body}
                      </Text>
                    </View>
                  ))
                )}
                {sendMessage.isPending ? (
                  <View style={{ alignSelf: "flex-start", padding: 11, borderRadius: 14, backgroundColor: t.surface2, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color={t.ink3} />
                    <Text style={{ fontSize: 12, color: t.ink3 }}>Thinking…</Text>
                  </View>
                ) : null}
                {error ? (
                  <View style={{ padding: 10, borderRadius: 9, backgroundColor: t.dangerBg }}>
                    <Text style={{ fontSize: 12, color: t.danger }}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Composer */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  borderTopWidth: 1,
                  borderTopColor: t.line,
                  backgroundColor: t.bg,
                }}
              >
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message…"
                  placeholderTextColor={t.ink4}
                  editable={!sendMessage.isPending}
                  onSubmitEditing={() => send(input)}
                  returnKeyType="send"
                  multiline
                  style={{
                    flex: 1,
                    minHeight: 40,
                    maxHeight: 120,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.line,
                    color: t.ink,
                    fontSize: 14,
                  }}
                />
                <Pressable
                  onPress={() => send(input)}
                  disabled={!input.trim() || sendMessage.isPending}
                  accessibilityLabel="Send"
                  style={({ pressed }) => ({
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: input.trim() && !sendMessage.isPending ? t.petrol : t.chip,
                    alignItems: "center", justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Icon name="arrowR" size={18} color={input.trim() && !sendMessage.isPending ? "#fff" : t.ink4} />
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ConversationRow({
  t,
  title,
  subtitleHeader,
  subtitle,
  timestamp,
  accent,
  empty,
  isActive,
  onPress,
}: {
  t: ReturnType<typeof useTheme>["t"];
  title: string;
  subtitleHeader?: string;
  subtitle: string;
  timestamp: string | null;
  accent: "petrol" | "brand";
  empty: boolean;
  isActive: boolean;
  onPress: () => void;
}) {
  const accentColor = accent === "petrol" ? t.petrol : t.brand;
  const accentBg = accent === "petrol" ? t.petrolSoft : t.brandSoft;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isActive ? accentColor : t.line,
        backgroundColor: pressed ? t.surface2 : (isActive ? accentBg : "transparent"),
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: accentBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="chat" size={16} color={accentColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }} numberOfLines={1}>
            {title}
          </Text>
          {timestamp ? (
            <Text style={{ fontSize: 10.5, color: t.ink4 }}>
              {new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
          ) : null}
        </View>
        {subtitleHeader ? (
          <Text style={{ fontSize: 11.5, color: t.ink3, marginTop: 1 }} numberOfLines={1}>
            {subtitleHeader}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: 12,
            color: empty ? t.ink4 : t.ink2,
            fontStyle: empty ? "italic" : "normal",
            marginTop: 4,
            lineHeight: 17,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <Icon name="chevR" size={14} color={t.ink4} />
    </Pressable>
  );
}
