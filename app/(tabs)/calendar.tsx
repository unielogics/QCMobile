// Borrower / operator agenda. Wired to the real /calendar API (alembic
// 0013+). Backend handles audience scoping — clients only see their
// own loan's manual + auto events; raw `source='ai'` rows never leak
// here, they live operator-side until approved through the AITask
// flow. The tab title intentionally stays "Activity" to match the
// existing mobile vocabulary.

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { Fab } from "@/components/Fab";
import { AIChatSheet } from "@/components/sheets/AIChatSheet";
import { useCalendar, useUpdateCalendarEvent } from "@/hooks/useApi";
import { KIND_META } from "@/lib/sample-data";
import type { CalendarEvent } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "doc", label: "Docs" },
  { id: "call", label: "Calls" },
  { id: "milestone", label: "Milestones" },
  { id: "ai", label: "AI" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const DAY_MS = 24 * 60 * 60 * 1000;

const dayLabel = (offset: number) => {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  if (offset < 0) return `${Math.abs(offset)} days ago`;
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const shortDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const HHMM = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });

export default function CalendarScreen() {
  const { t } = useTheme();
  const [filter, setFilter] = useState<FilterId>("all");
  const [showAIChat, setShowAIChat] = useState(false);
  const { data: events = [], isLoading, error } = useCalendar();
  const update = useUpdateCalendarEvent();

  const filtered = useMemo(
    () => events.filter((e) => filter === "all" || e.kind === filter),
    [events, filter],
  );

  // Group by day-offset from today (so the existing "Today / Tomorrow / N days"
  // ordering still works). Past events are hidden by default — the backend
  // already returns recent + future, but we trim anything older than yesterday.
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const byDay = useMemo(() => {
    const acc: Record<number, CalendarEvent[]> = {};
    for (const e of filtered) {
      const ts = new Date(e.starts_at).getTime();
      const offset = Math.floor((ts - todayMidnight) / DAY_MS);
      if (offset < -1) continue;
      (acc[offset] = acc[offset] || []).push(e);
    }
    return acc;
  }, [filtered, todayMidnight]);

  const dayKeys = useMemo(
    () => Object.keys(byDay).map(Number).sort((a, b) => a - b),
    [byDay],
  );

  const HUE_FG = { brand: t.brand, gold: t.gold, petrol: t.petrol } as const;
  const HUE_BG = { brand: t.brandSoft, gold: t.goldSoft, petrol: t.petrolSoft } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Activity" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 4, paddingLeft: 4 }}
          style={{ marginHorizontal: -4, marginBottom: 12 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: active ? t.ink : t.chip,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.inverse : t.ink2 }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading / error / empty / day groups */}
        {isLoading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator color={t.ink3} />
          </View>
        ) : error ? (
          <Text style={{ textAlign: "center", color: t.danger, fontSize: 12, paddingVertical: 24 }}>
            Couldn&apos;t load your calendar. Pull to refresh.
          </Text>
        ) : dayKeys.length === 0 ? (
          <Text style={{ textAlign: "center", color: t.ink4, fontSize: 12, paddingVertical: 24 }}>
            Nothing scheduled
          </Text>
        ) : (
          <View style={{ gap: 18 }}>
            {dayKeys.map((dayKey) => {
              const evs = byDay[dayKey]
                .slice()
                .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
              return (
                <View key={dayKey}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.3, color: t.ink }}>
                        {dayLabel(dayKey)}
                      </Text>
                      {dayKey !== 0 && dayKey !== 1 ? (
                        <Text style={{ fontSize: 11, color: t.ink3 }}>{shortDate(dayKey)}</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>
                      {evs.length} item{evs.length === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <Card pad={0}>
                    {evs.map((e, i) => {
                      const meta = KIND_META[e.kind as keyof typeof KIND_META];
                      const hue = meta ? HUE_FG[meta.hue] : t.brand;
                      const hbg = meta ? HUE_BG[meta.hue] : t.brandSoft;
                      const isPriority = e.priority === "high";
                      const isDone = e.status === "done";
                      const isCancelled = e.status === "cancelled";
                      const onToggleDone = () => {
                        update.mutate({
                          id: e.id,
                          patch: { status: isDone ? "pending" : "done" },
                        });
                      };
                      return (
                        <Pressable
                          key={e.id}
                          onPress={onToggleDone}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderBottomWidth: i < evs.length - 1 ? 1 : 0,
                            borderBottomColor: t.line,
                            backgroundColor: pressed ? t.surface2 : "transparent",
                            opacity: isDone || isCancelled ? 0.55 : 1,
                          })}
                        >
                          {/* Done checkbox */}
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              borderWidth: 1.5,
                              borderColor: isDone ? t.profit : t.lineStrong,
                              backgroundColor: isDone ? t.profit : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isDone ? <Icon name="check" size={12} color={t.inverse} /> : null}
                          </View>
                          <Text style={{ minWidth: 44, fontSize: 11, fontWeight: "700", color: t.ink2, letterSpacing: 0.3 }}>
                            {HHMM(e.starts_at)}
                          </Text>
                          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: hbg, alignItems: "center", justifyContent: "center" }}>
                            <Icon name={meta?.icon ?? "calendar"} size={15} color={hue} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text
                                numberOfLines={1}
                                style={{
                                  flex: 1,
                                  fontSize: 13,
                                  fontWeight: "600",
                                  color: t.ink,
                                  letterSpacing: -0.2,
                                  textDecorationLine: isDone || isCancelled ? "line-through" : "none",
                                }}
                              >
                                {e.title}
                              </Text>
                              {isPriority ? (
                                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: t.danger }} />
                              ) : null}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                              {e.who ? (
                                <Text numberOfLines={1} style={{ fontSize: 11, color: t.ink3 }}>
                                  {e.who}
                                </Text>
                              ) : null}
                              {e.source === "auto" ? (
                                <>
                                  {e.who ? <Text style={{ fontSize: 11, color: t.ink3 }}>·</Text> : null}
                                  <Text style={{ fontSize: 10, fontWeight: "700", color: t.petrol, letterSpacing: 0.5 }}>
                                    AUTO
                                  </Text>
                                </>
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </Card>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* AI Intelligent Underwriter — same FAB pattern as the
          dashboard. The borrower can ask "what's coming up next
          week?" or "anything overdue?" without leaving the calendar. */}
      <Fab onPress={() => setShowAIChat(true)} icon="chat" />
      <AIChatSheet
        visible={showAIChat}
        onClose={() => setShowAIChat(false)}
        context="From your calendar"
      />
    </SafeAreaView>
  );
}
