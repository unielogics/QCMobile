// AI Secretary workbench — lists outstanding AI questions on this
// loan and lets the agent answer them inline. Mirrors the desktop
// "AI Secretary" tab. Phase 4 — gated by BACKEND_HAS_AI_SECRETARY.

import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, SectionLabel } from "@/design-system/primitives";
import { BottomSheet } from "@/components/sheets/BottomSheet";
import { useAIQuestions, useAnswerAIQuestion, usePauseAISecretary, useStartAISecretary } from "@/hooks/useApi";
import type { AIQuestion } from "@/lib/mocks";

export function AISecretaryTab({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data = [], isLoading } = useAIQuestions(loanId);
  const start = useStartAISecretary();
  const pause = usePauseAISecretary();
  const [active, setActive] = useState<AIQuestion | null>(null);

  const open = data.filter((q) => q.status === "open");

  return (
    <View style={{ gap: 12 }}>
      <Card pad={14}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <SectionLabel>AI Secretary</SectionLabel>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              onPress={() => start.mutate(loanId)}
              disabled={start.isPending}
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                backgroundColor: pressed ? t.brandSoft : t.chip,
              })}
            >
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: t.ink }}>Start</Text>
            </Pressable>
            <Pressable
              onPress={() => pause.mutate(loanId)}
              disabled={pause.isPending}
              style={({ pressed }) => ({
                paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
                backgroundColor: pressed ? t.warnBg : t.chip,
              })}
            >
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: t.ink }}>Pause</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: t.ink3, marginTop: 4 }}>
          {open.length} open question{open.length === 1 ? "" : "s"}
        </Text>
      </Card>
      {isLoading ? (
        <Card pad={18}><Text style={{ fontSize: 13, color: t.ink3 }}>Loading…</Text></Card>
      ) : data.length === 0 ? (
        <Card pad={18}><Text style={{ fontSize: 13, color: t.ink3 }}>No AI questions on this file yet.</Text></Card>
      ) : (
        <Card pad={0}>
          {data.map((q, i) => (
            <Pressable
              key={q.id}
              onPress={() => setActive(q)}
              style={({ pressed }) => ({
                padding: 14,
                opacity: pressed ? 0.85 : 1,
                borderBottomColor: t.line,
                borderBottomWidth: i < data.length - 1 ? 1 : 0,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Pill
                  bg={q.status === "answered" ? t.profitBg : t.warnBg}
                  color={q.status === "answered" ? t.profit : t.warn}
                >
                  {q.status}
                </Pill>
                <Text style={{ fontSize: 10.5, color: t.ink3 }}>
                  {new Date(q.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: t.ink, lineHeight: 18 }} numberOfLines={3}>{q.body}</Text>
            </Pressable>
          ))}
        </Card>
      )}
      <AnswerSheet visible={!!active} onClose={() => setActive(null)} loanId={loanId} question={active} />
    </View>
  );
}

function AnswerSheet({ visible, onClose, loanId, question }: {
  visible: boolean;
  onClose: () => void;
  loanId: string;
  question: AIQuestion | null;
}) {
  const { t } = useTheme();
  const answer = useAnswerAIQuestion();
  const [draft, setDraft] = useState(question?.answered_body ?? "");

  if (!question) return null;
  const submit = async () => {
    if (!draft.trim()) return;
    await answer.mutateAsync({ loanId, questionId: question.id, answer: draft.trim() });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Answer AI question"
      subtitle={question.context ?? null}
      headerAction={
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || answer.isPending}
          style={({ pressed }) => ({
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
            backgroundColor: draft.trim() ? t.brand : t.chip,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {answer.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: draft.trim() ? "#fff" : t.ink3, fontWeight: "700", fontSize: 12.5 }}>Send</Text>
          )}
        </Pressable>
      }
    >
      <Text style={{ fontSize: 13, color: t.ink, lineHeight: 19, marginBottom: 12 }}>{question.body}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Your answer…"
        placeholderTextColor={t.ink4}
        style={{
          minHeight: 120,
          padding: 12,
          borderRadius: 10,
          backgroundColor: t.surface2,
          borderColor: t.line, borderWidth: 1,
          color: t.ink, fontSize: 14,
          textAlignVertical: "top",
        }}
      />
    </BottomSheet>
  );
}
