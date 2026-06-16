// Borrower / agent calendar. Backend scopes /calendar by role; this
// screen keeps Today on a real vertical clock while future days remain compact.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { useCalendar, useCalendarActivity, useCurrentUser, useUpdateCalendarEvent } from "@/hooks/useApi";
import { KIND_META } from "@/lib/sample-data";
import type { CalendarActivityItem, CalendarEvent } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PX_PER_MINUTE = 1.9;
const MIN_EVENT_HEIGHT = 58;
const NOW_LINE_RATIO = 0.4;

export default function CalendarScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const [nowTs, setNowTs] = useState(() => Date.now());
  const todayStart = useMemo(() => startOfLocalDay(new Date(nowTs)), [nowTs]);
  const queryWindow = useMemo(() => ({
    from: new Date(todayStart.getTime() - DAY_MS).toISOString(),
    to: new Date(todayStart.getTime() + 31 * DAY_MS).toISOString(),
  }), [todayStart]);
  const activityWindow = useMemo(() => ({
    from: new Date(todayStart.getTime() - 30 * DAY_MS).toISOString(),
    to: new Date(todayStart.getTime() + DAY_MS).toISOString(),
    limit: 60,
  }), [todayStart]);
  const { data: me } = useCurrentUser();
  const isClient = me?.role === "client";
  const { data: events = [], isLoading, isRefetching, error, refetch } = useCalendar(queryWindow);
  const { data: activity = [] } = useCalendarActivity(activityWindow);
  const update = useUpdateCalendarEvent();

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const visibleEvents = useMemo(
    () =>
      events
        .filter((e) => {
          const ts = new Date(e.starts_at).getTime();
          return ts >= todayStart.getTime() - DAY_MS && ts <= todayStart.getTime() + 30 * DAY_MS;
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events, todayStart],
  );
  const todayEvents = useMemo(
    () => visibleEvents.filter((e) => isSameLocalDay(new Date(e.starts_at), new Date(nowTs))),
    [visibleEvents, nowTs],
  );
  const byUpcomingDay = useMemo(() => {
    const acc: Record<string, CalendarEvent[]> = {};
    for (const event of visibleEvents) {
      const starts = new Date(event.starts_at);
      if (isSameLocalDay(starts, new Date(nowTs))) continue;
      if (starts.getTime() < todayStart.getTime()) continue;
      const key = localDateKey(starts);
      (acc[key] ||= []).push(event);
    }
    return acc;
  }, [visibleEvents, nowTs, todayStart]);
  const upcomingDays = Object.keys(byUpcomingDay).sort().slice(0, 10);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Calendar" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, gap: 14 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={t.ink3}
          />
        }
      >
        {isLoading ? (
          <View style={{ paddingVertical: 32, alignItems: "center" }}>
            <ActivityIndicator color={t.ink3} />
          </View>
        ) : error ? (
          <Text style={{ textAlign: "center", color: t.danger, fontSize: 12, paddingVertical: 24 }}>
            Couldn't load your calendar. Pull to refresh.
          </Text>
        ) : (
          <>
            <TodayTimeline
              events={todayEvents}
              nowTs={nowTs}
              onOpenDocument={(documentId) => router.push({ pathname: "/(tabs)/vault", params: { fulfill: documentId } })}
              onToggle={(event) => {
                update.mutate({
                  id: event.id,
                  patch: { status: event.status === "done" ? "pending" : "done" },
                });
              }}
            />

            {isClient ? <ClientActivity rows={activity} /> : null}

            {upcomingDays.length > 0 ? (
              <View style={{ gap: 14 }}>
                {upcomingDays.map((dayKey) => {
                  const dayEvents = byUpcomingDay[dayKey]
                    .slice()
                    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
                  return (
                    <View key={dayKey} style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>{formatDayHeader(dayKey)}</Text>
                        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>
                          {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <View style={{ gap: 8 }}>
                        {dayEvents.map((event) => (
                          <CompactEventRow
                            key={event.id}
                            event={event}
                            onPress={() => {
                              if (isDocumentDue(event) && event.status !== "done" && event.external_ref_id) {
                                router.push({ pathname: "/(tabs)/vault", params: { fulfill: event.external_ref_id } });
                                return;
                              }
                              update.mutate({
                                id: event.id,
                                patch: { status: event.status === "done" ? "pending" : "done" },
                              });
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 14, padding: 16 }}>
                <Text style={{ textAlign: "center", color: t.ink3, fontSize: 12.5 }}>No upcoming events after today.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TodayTimeline({
  events,
  nowTs,
  onToggle,
  onOpenDocument,
}: {
  events: CalendarEvent[];
  nowTs: number;
  onToggle: (event: CalendarEvent) => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const { t } = useTheme();
  const scrollRef = useRef<ScrollView | null>(null);
  const [containerHeight, setContainerHeight] = useState(560);
  const layout = useMemo(() => buildTimelineLayout(events, new Date(nowTs)), [events, nowTs]);

  const alignNow = useCallback(() => {
    const target = Math.max(0, layout.currentOffset - containerHeight * NOW_LINE_RATIO);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }, [containerHeight, layout.currentOffset]);

  useEffect(() => {
    alignNow();
    const id = setTimeout(alignNow, 80);
    return () => clearTimeout(id);
  }, [alignNow, events.length]);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.surface,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 13, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Today</Text>
            <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800", marginTop: 2 }}>
              Fixed timeline · {formatClock(new Date(nowTs))}
            </Text>
          </View>
          <View style={{ backgroundColor: t.chip, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }}>
            <Text style={{ fontSize: 11, color: t.ink2, fontWeight: "800" }}>
              {events.length} item{events.length === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      </View>

      <View
        onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
        style={{ height: 560, position: "relative", overflow: "hidden", backgroundColor: t.surface }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${NOW_LINE_RATIO * 100}%`,
            zIndex: 5,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              marginLeft: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: "rgba(239,68,68,0.16)",
              color: "#ef4444",
              fontSize: 10,
              fontWeight: "900",
              overflow: "hidden",
            }}
          >
            {formatClock(new Date(nowTs))}
          </Text>
          <View style={{ height: 2, flex: 1, backgroundColor: "#ef4444" }} />
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ height: layout.height, minHeight: 560, position: "relative" }}>
            {layout.hours.map((hour) => (
              <View
                key={hour.minute}
                style={{
                  position: "absolute",
                  top: hour.top,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: t.line,
                }}
              >
                <Text style={{ position: "absolute", top: -8, left: 10, width: 46, fontSize: 10, color: t.ink4, fontWeight: "800" }}>
                  {formatHour(hour.minute)}
                </Text>
              </View>
            ))}

            <View style={{ position: "absolute", left: 58, right: 10, top: 0, bottom: 0 }}>
              {layout.items.length === 0 ? (
                <View
                  style={{
                    position: "absolute",
                    top: Math.max(30, layout.currentOffset + 32),
                    left: 0,
                    right: 0,
                    borderWidth: 1,
                    borderColor: t.lineStrong,
                    borderStyle: "dashed",
                    borderRadius: 12,
                    padding: 13,
                  }}
                >
                  <Text style={{ color: t.ink3, textAlign: "center", fontSize: 12.5 }}>Nothing scheduled today.</Text>
                </View>
              ) : null}

              {layout.items.map((item) => (
                <TimelineEvent
                  key={item.event.id}
                  item={item}
                  onPress={() => {
                    if (isDocumentDue(item.event) && item.event.status !== "done" && item.event.external_ref_id) {
                      onOpenDocument(item.event.external_ref_id);
                      return;
                    }
                    onToggle(item.event);
                  }}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function TimelineEvent({ item, onPress }: { item: TimelineItem; onPress: () => void }) {
  const { t } = useTheme();
  const event = item.event;
  const tone = eventTone(event, t);
  const meta = KIND_META[event.kind as keyof typeof KIND_META];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        top: item.top,
        left: `${(item.column / item.columnCount) * 100}%`,
        width: `${100 / item.columnCount}%`,
        height: item.height,
        paddingRight: item.columnCount > 1 ? 6 : 0,
        opacity: event.status === "cancelled" ? 0.58 : pressed ? 0.84 : 1,
      })}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tone.fg,
          backgroundColor: tone.bg,
          padding: 9,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Icon name={meta?.icon ?? "cal"} size={13} color={tone.fg} />
          <Text style={{ fontSize: 11, color: tone.fg, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {formatClock(new Date(event.starts_at))}
          </Text>
          {event.duration_min ? <Text style={{ fontSize: 10, color: t.ink3 }}>{event.duration_min}m</Text> : null}
        </View>
        <Text
          numberOfLines={2}
          style={{
            color: t.ink,
            fontSize: 13,
            fontWeight: "900",
            marginTop: 5,
            textDecorationLine: event.status === "done" || event.status === "cancelled" ? "line-through" : "none",
          }}
        >
          {event.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" }}>
          <Text style={{ fontSize: 10, color: tone.fg, fontWeight: "900", textTransform: "uppercase" }}>
            {tone.label || event.kind}
          </Text>
          {event.who ? (
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 10.5, color: t.ink3 }}>
              {event.who}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function CompactEventRow({ event, onPress }: { event: CalendarEvent; onPress: () => void }) {
  const { t } = useTheme();
  const tone = eventTone(event, t);
  const meta = KIND_META[event.kind as keyof typeof KIND_META];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tone.fg,
        backgroundColor: pressed ? t.surface2 : tone.bg,
        opacity: event.status === "cancelled" ? 0.6 : 1,
      })}
    >
      <Text style={{ minWidth: 42, fontSize: 11, fontWeight: "800", color: tone.fg, fontVariant: ["tabular-nums"] }}>
        {formatClock(new Date(event.starts_at))}
      </Text>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.bg, borderWidth: 1, borderColor: tone.fg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={meta?.icon ?? "cal"} size={13} color={tone.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "800", color: t.ink, textDecorationLine: event.status === "done" || event.status === "cancelled" ? "line-through" : "none" }}>
          {event.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
          {[tone.label, event.who, event.duration_min ? `${event.duration_min}m` : null].filter(Boolean).join(" · ") || event.kind}
        </Text>
      </View>
    </Pressable>
  );
}

function ClientActivity({ rows }: { rows: CalendarActivityItem[] }) {
  const { t } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
        Account activity
      </Text>
      {rows.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: t.ink3 }}>No recent borrower-visible activity.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.slice(0, 12).map((row) => (
            <View key={row.id} style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
              <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name={activityIcon(row.kind)} size={13} color={t.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={{ fontSize: 12.5, color: t.ink, fontWeight: "700" }}>
                  {row.summary || humanize(row.kind)}
                </Text>
                <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
                  {humanize(row.kind)} · {new Date(row.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface TimelineItem {
  event: CalendarEvent;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  column: number;
  columnCount: number;
}

function buildTimelineLayout(events: CalendarEvent[], now: Date) {
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const raw = events
    .map((event) => {
      const starts = new Date(event.starts_at);
      const startMinute = starts.getHours() * 60 + starts.getMinutes();
      const duration = Math.max(15, event.duration_min ?? 30);
      return { event, startMinute, endMinute: Math.min(24 * 60, startMinute + duration) };
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const minMinute = Math.min(nowMinute, ...raw.map((x) => x.startMinute));
  const maxMinute = Math.max(nowMinute, ...raw.map((x) => x.endMinute));
  const rangeStart = Math.max(0, Math.floor(minMinute / 60) * 60 - 60);
  const rangeEnd = Math.min(24 * 60, Math.ceil(maxMinute / 60) * 60 + 60);
  const height = Math.max(560, (rangeEnd - rangeStart) * PX_PER_MINUTE);
  const items: TimelineItem[] = [];

  for (const cluster of clusterOverlaps(raw)) {
    const colEnds: number[] = [];
    const clusterItems = cluster.map((item) => {
      let column = colEnds.findIndex((end) => end <= item.startMinute);
      if (column === -1) {
        column = colEnds.length;
        colEnds.push(item.endMinute);
      } else {
        colEnds[column] = item.endMinute;
      }
      return { ...item, column };
    });
    const columnCount = Math.max(1, colEnds.length);
    for (const item of clusterItems) {
      items.push({
        ...item,
        top: (item.startMinute - rangeStart) * PX_PER_MINUTE,
        height: Math.max((item.endMinute - item.startMinute) * PX_PER_MINUTE, MIN_EVENT_HEIGHT),
        columnCount,
      });
    }
  }
  const hours = [];
  for (let minute = rangeStart; minute <= rangeEnd; minute += 60) {
    hours.push({ minute, top: (minute - rangeStart) * PX_PER_MINUTE });
  }
  return {
    rangeStart,
    rangeEnd,
    height,
    currentOffset: (nowMinute - rangeStart) * PX_PER_MINUTE,
    items,
    hours,
  };
}

function clusterOverlaps<T extends { startMinute: number; endMinute: number }>(items: T[]): T[][] {
  const clusters: T[][] = [];
  let active: T[] = [];
  let activeEnd = -1;
  for (const item of items) {
    if (active.length === 0 || item.startMinute < activeEnd) {
      active.push(item);
      activeEnd = Math.max(activeEnd, item.endMinute);
    } else {
      clusters.push(active);
      active = [item];
      activeEnd = item.endMinute;
    }
  }
  if (active.length) clusters.push(active);
  return clusters;
}

function eventTone(event: CalendarEvent, t: ReturnType<typeof useTheme>["t"]) {
  const done = event.status === "done";
  const cancelled = event.status === "cancelled";
  const overdue = !done && !cancelled && new Date(event.starts_at).getTime() < Date.now();
  if (cancelled) return { fg: t.ink3, bg: t.surface2, label: "Cancelled" };
  if (done) return { fg: t.profit, bg: t.profitBg, label: "Done" };
  if (overdue) return { fg: t.danger, bg: t.dangerBg, label: "Overdue" };
  return { fg: t.warn, bg: t.warnBg, label: "" };
}

function isDocumentDue(event: CalendarEvent): boolean {
  return event.external_ref_kind === "document_due" && !!event.external_ref_id;
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatHour(minute: number): string {
  const d = new Date();
  d.setHours(Math.floor(minute / 60), 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

function activityIcon(kind: string) {
  if (kind.startsWith("document")) return "doc";
  if (kind.startsWith("calendar")) return "cal";
  if (kind.startsWith("prequal")) return "docCheck";
  if (kind.startsWith("analysis")) return "calc";
  return "audit";
}

function humanize(kind: string): string {
  return kind.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
