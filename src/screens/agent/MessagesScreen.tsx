import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { TopBar } from "@/components/TopBar";
import { StageFilterChips } from "@/components/agent/StageFilterChips";
import { useAIChatThreads } from "@/hooks/useApi";
import type { AIChatThread } from "@/lib/types";

type FilterKey = "unread" | "needs_reply" | "ai_drafted";

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "unread", label: "Unread" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "ai_drafted", label: "AI drafted" },
];

function lastMessageRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const min = ms / 60_000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.floor(min)}m`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)}h`;
  return `${Math.floor(hr / 24)}d`;
}

function applyFilter(threads: AIChatThread[], filter: FilterKey | null): AIChatThread[] {
  if (filter === "unread") return threads.filter((th) => th.unread);
  // "Needs reply" and "AI drafted" are backend-derived signals not yet
  // present on the mobile thread shape — until they land, both filters
  // fall back to "show everything" so the chips don't dead-end the UI.
  return threads;
}

export function MessagesScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: threads = [] } = useAIChatThreads();
  const [filter, setFilter] = useState<FilterKey | null>(null);

  const filtered = useMemo(() => {
    const list = applyFilter(threads, filter);
    return [...list].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  }, [threads, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Messages" />
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <StageFilterChips
          options={FILTERS}
          selected={filter}
          onChange={setFilter}
          allLabel="All"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        {filtered.length === 0 ? (
          <Card pad={18}>
            <Text style={{ fontSize: 13, color: t.ink2 }}>
              {filter === "unread" ? "Nothing unread." : "No threads yet — open a deal to start the AI chat."}
            </Text>
          </Card>
        ) : (
          filtered.map((th) => (
            <Pressable
              key={th.id}
              onPress={() => router.push(`/agent/messages/${th.id}` as Href)}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "flex-start", gap: 12,
                paddingVertical: 12, paddingHorizontal: 14,
                backgroundColor: t.surface, borderColor: t.line, borderWidth: 1,
                borderRadius: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {th.unread ? (
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: t.brand, marginTop: 6 }} />
              ) : (
                <View style={{ width: 8 }} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink, flexShrink: 1 }} numberOfLines={1}>
                    {th.title || th.loan_address || "Conversation"}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.ink3 }}>{lastMessageRelativeTime(th.last_message_at)}</Text>
                </View>
                {th.last_message_preview ? (
                  <Text style={{ fontSize: 12, color: t.ink2, marginTop: 4 }} numberOfLines={2}>{th.last_message_preview}</Text>
                ) : null}
                {th.loan_deal_id ? (
                  <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 0.6, marginTop: 6 }}>
                    {th.loan_deal_id}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
