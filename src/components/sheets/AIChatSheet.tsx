// AI Intelligent Underwriter chat sheet (mobile, account-wide).
//
// Opened from the FAB on Dashboard / Calendar tabs. Per-loan chats
// live inside each loan's detail screen and are unaffected.
//
// Phase 8: every conversation persists to the DB. The "threads" icon
// in the header swaps the conversation view for the thread list —
// tap a thread to switch in, long-press to delete, or "New
// conversation" to reset to the starter prompts.
//
// Layout: full-screen native-messaging feel — thin header at the
// top, thread fills the middle, composer pinned at the bottom and
// rides the keyboard up.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  useCreateAIChatThread,
  useDeleteAIChatThread,
  useSendAIChatMessage,
} from "@/hooks/useApi";

interface Props {
  visible: boolean;
  onClose: () => void;
  // Optional sub-title — caller can hint context, e.g. "From your dashboard".
  context?: string;
}

const STARTER_PROMPTS = [
  "What's the next thing I need to do?",
  "Are any of my docs overdue?",
  "What's blocking my deal from closing?",
  "Show me my current pipeline",
];

export function AIChatSheet({ visible, onClose, context }: Props) {
  const { t } = useTheme();
  const threadsQ = useAIChatThreads();
  const createThread = useCreateAIChatThread();
  const sendMessage = useSendAIChatMessage();
  const deleteThread = useDeleteAIChatThread();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const activeThreadQ = useAIChatThread(activeThreadId);
  const messages = activeThreadQ.data?.messages ?? [];

  // On first open of the sheet, snap onto the most recent thread
  // (or stay in starter-prompts mode when there are none).
  useEffect(() => {
    if (!visible) return;
    if (activeThreadId == null && threadsQ.data && threadsQ.data.length > 0) {
      setActiveThreadId(threadsQ.data[0].id);
    }
  }, [visible, threadsQ.data, activeThreadId]);

  // Auto-scroll the thread to the bottom when a new message lands or
  // the AI starts thinking.
  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, sendMessage.isPending]);

  const startNew = () => {
    setActiveThreadId(null);
    setShowList(false);
    setInput("");
    setError(null);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sendMessage.isPending) return;
    setError(null);
    try {
      let threadId = activeThreadId;
      if (!threadId) {
        const created = await createThread.mutateAsync({});
        threadId = created.id;
        setActiveThreadId(threadId);
      }
      await sendMessage.mutateAsync({ threadId, body: text });
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed to respond.");
    }
  };

  const promptDelete = (threadId: string) => {
    Alert.alert(
      "Delete conversation?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteThread.mutateAsync(threadId);
              if (activeThreadId === threadId) setActiveThreadId(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed");
            }
          },
        },
      ]
    );
  };

  const sortedThreads = threadsQ.data ?? [];
  const activeTitle = activeThreadQ.data?.title;

  return (
    <Modal
      // Full-screen presentation rather than a transparent overlay — we
      // want a native-messaging-app feel: header at the top, thread in
      // the middle, composer pinned at the bottom, keyboard pushing the
      // composer up and shrinking the thread above it.
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          // Manual top inset for the status bar — using SafeAreaView from
          // react-native-safe-area-context inside a Modal swallowed all
          // touches on Android (SafeAreaProvider context doesn't extend
          // into Modal children). Plain View + StatusBar.currentHeight
          // gives us the same layout without breaking hit-testing.
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
        }}
      >
        <KeyboardAvoidingView
          // Android needs explicit behavior — undefined leaves the
          // keyboard floating over the composer. "height" pairs with
          // adjustResize in the manifest. iOS gets "padding".
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Header bar — back/close on the left, AI label center,
              threads-toggle on the right. Slim so the thread gets max
              vertical space. */}
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
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={10}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 999,
                backgroundColor: pressed ? t.chip : "transparent",
                alignItems: "center", justifyContent: "center",
              })}
            >
              <Icon name="chevL" size={18} color={t.ink2} />
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
                {showList ? "Conversations" : "AI Intelligent Underwriter"}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}
              >
                {showList
                  ? `${sortedThreads.length} saved`
                  : (activeTitle ?? context ?? "Cross-loan account context")}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowList((s) => !s)}
              accessibilityLabel={showList ? "Back to conversation" : "Browse conversations"}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 999,
                backgroundColor: pressed ? t.chip : "transparent",
                alignItems: "center", justifyContent: "center",
              })}
            >
              <Icon name={showList ? "x" : "layers"} size={16} color={t.ink2} />
            </Pressable>
          </View>

          {showList ? (
            // ── Thread list view ─────────────────────────────────────
            <ScrollView
              style={{ flex: 1, backgroundColor: t.bg }}
              contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={startNew}
                style={({ pressed }) => ({
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: t.petrol,
                  backgroundColor: pressed ? t.brandSoft : t.bg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                })}
              >
                <Icon name="plus" size={14} color={t.petrol} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: t.petrol }}>
                  New conversation
                </Text>
              </Pressable>
              {threadsQ.isLoading ? (
                <Text style={{ fontSize: 12, color: t.ink3, paddingVertical: 8 }}>Loading…</Text>
              ) : sortedThreads.length === 0 ? (
                <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 18, paddingVertical: 8 }}>
                  No conversations yet. Tap “New conversation” to start one.
                </Text>
              ) : (
                sortedThreads.map((tr) => {
                  const isActive = tr.id === activeThreadId;
                  return (
                    <Pressable
                      key={tr.id}
                      onPress={() => {
                        setActiveThreadId(tr.id);
                        setShowList(false);
                      }}
                      onLongPress={() => promptDelete(tr.id)}
                      style={({ pressed }) => ({
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isActive ? t.petrol : t.line,
                        backgroundColor: pressed ? t.surface2 : (isActive ? t.brandSoft : "transparent"),
                      })}
                    >
                      <Text
                        style={{ fontSize: 13, fontWeight: "700", color: isActive ? t.brand : t.ink }}
                        numberOfLines={1}
                      >
                        {tr.title}
                      </Text>
                      {tr.last_message_preview ? (
                        <Text
                          style={{ fontSize: 11.5, color: t.ink3, marginTop: 4, lineHeight: 16 }}
                          numberOfLines={2}
                        >
                          {tr.last_message_preview}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          ) : (
            <>
              {/* Thread — fills all the space between header and composer */}
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, gap: 10 }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, backgroundColor: t.bg }}
                // keyboardShouldPersistTaps so tapping a starter prompt or
                // the send button while the keyboard is open fires the
                // press without first being eaten by the dismiss-keyboard
                // gesture. interactive lets a downward drag pull the
                // keyboard back down.
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

              {/* Composer — pinned to the bottom edge of the
                  KeyboardAvoidingView, so when the keyboard rises the
                  composer rides up with it and the thread above shrinks. */}
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
