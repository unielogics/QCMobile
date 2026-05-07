// AI Intelligent Underwriter chat sheet (mobile, account-wide).
//
// Opened from the FAB on Dashboard / Calendar tabs. Per-loan chats
// live inside each loan's detail screen and are unaffected. This
// surface is borrower-facing first — clients ask questions about
// their pipeline and the AI answers using the cross-loan context
// that Phase 8's client_summarizer feeds in (TODO: when the
// account-wide context endpoint lands, swap the loan_id=null
// fallback for a richer payload).
//
// The sheet keeps a local message list (not persisted yet — Phase 8
// follow-up will land a persistent /me/ai-chat endpoint with full
// history). For now every open of the sheet starts a fresh thread,
// which is fine because borrowers come here for short-form
// "what's next?" questions, not long conversations.

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";
import { useAIChat } from "@/hooks/useApi";
import type { AIChatTurn } from "@/lib/types";

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
  const chat = useAIChat();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<AIChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Reset on each open so a fresh thread doesn't show last session's turns.
  useEffect(() => {
    if (visible) {
      setHistory([]);
      setInput("");
      setError(null);
    }
  }, [visible]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || chat.isPending) return;
    setError(null);
    const userTurn: AIChatTurn = { role: "user", content: text };
    const next = [...history, userTurn];
    setHistory(next);
    setInput("");
    try {
      const resp = await chat.mutateAsync({
        messages: next,
        // No loan_id — account-wide context. Backend's /ai/chat
        // accepts loan_id=null and answers without per-deal scoping.
        loan_id: null,
      });
      setHistory((h) => [...h, { role: "assistant", content: resp.reply }]);
      // Defer to next tick so the new turn renders before we scroll.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed to respond.");
    }
  };

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
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          // Android needs explicit behavior — undefined leaves the
          // keyboard floating over the composer. "height" pairs with
          // adjustResize in the manifest. iOS gets "padding".
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {/* Header bar — back/close on the left, AI label center,
              spacer right. Slim so the thread gets max vertical space. */}
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
                AI Intelligent Underwriter
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}
              >
                {context ?? "Cross-loan account context"}
              </Text>
            </View>
          </View>

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
              {history.length === 0 ? (
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
                history.map((turn, i) => (
                  <View
                    key={i}
                    style={{
                      alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "86%",
                      padding: 11,
                      borderRadius: 14,
                      backgroundColor: turn.role === "user" ? t.brandSoft : t.surface2,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      color: turn.role === "user" ? t.brand : t.ink,
                      lineHeight: 18,
                    }}>
                      {turn.content}
                    </Text>
                  </View>
                ))
              )}
              {chat.isPending ? (
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
              editable={!chat.isPending}
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
              disabled={!input.trim() || chat.isPending}
              accessibilityLabel="Send"
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: input.trim() && !chat.isPending ? t.petrol : t.chip,
                alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name="arrowR" size={18} color={input.trim() && !chat.isPending ? "#fff" : t.ink4} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
