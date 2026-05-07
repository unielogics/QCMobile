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
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(6,7,11,0.55)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 16,
            height: "88%",
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.lineStrong, alignSelf: "center", marginBottom: 14 }} />

            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: t.petrol, letterSpacing: 1.4, textTransform: "uppercase" }}>
                  AI Intelligent Underwriter
                </Text>
                <Text style={{ fontSize: 19, fontWeight: "700", color: t.ink, letterSpacing: -0.4, marginTop: 2 }}>
                  How can I help?
                </Text>
                {context ? (
                  <Text style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>{context}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close"
                style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: t.chip, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="x" size={16} color={t.ink2} />
              </Pressable>
            </View>

            {/* Thread */}
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 12, gap: 10 }}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
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

            {/* Input */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.line }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type your question…"
                placeholderTextColor={t.ink4}
                editable={!chat.isPending}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
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
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: input.trim() && !chat.isPending ? t.petrol : t.chip,
                  alignItems: "center", justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Icon name="arrowR" size={18} color={input.trim() && !chat.isPending ? "#fff" : t.ink4} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
