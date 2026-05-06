import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { Fab } from "@/components/Fab";
import { SAMPLE_DATA, KIND_META, type SampleActivity } from "@/lib/sample-data";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "doc", label: "Docs" },
  { id: "call", label: "Calls" },
  { id: "milestone", label: "Milestones" },
  { id: "ai", label: "AI" },
] as const;

const dayLabel = (offset: number) => {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const shortDate = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function CalendarScreen() {
  const { t } = useTheme();
  const [filter, setFilter] = useState<typeof FILTERS[number]["id"]>("all");

  const events = SAMPLE_DATA.activity.filter((e) => filter === "all" || e.kind === filter);
  const byDay: Record<number, SampleActivity[]> = events.reduce((acc, e) => {
    (acc[e.d] = acc[e.d] || []).push(e);
    return acc;
  }, {} as Record<number, SampleActivity[]>);
  const dayKeys = Object.keys(byDay).map(Number).sort((a, b) => a - b);

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
                  paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
                  backgroundColor: active ? t.ink : t.chip,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.inverse : t.ink2 }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Day groups */}
        <View style={{ gap: 18 }}>
          {dayKeys.length === 0 ? (
            <Text style={{ textAlign: "center", color: t.ink4, fontSize: 12, paddingVertical: 24 }}>Nothing scheduled</Text>
          ) : null}
          {dayKeys.map((dayKey) => {
            const evs = byDay[dayKey].slice().sort((a, b) => a.t.localeCompare(b.t));
            return (
              <View key={dayKey}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.3, color: t.ink }}>{dayLabel(dayKey)}</Text>
                    {dayKey !== 0 && dayKey !== 1 ? <Text style={{ fontSize: 11, color: t.ink3 }}>{shortDate(dayKey)}</Text> : null}
                  </View>
                  <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>
                    {evs.length} item{evs.length === 1 ? "" : "s"}
                  </Text>
                </View>

                <Card pad={0}>
                  {evs.map((e, i) => {
                    const m = KIND_META[e.kind];
                    const hue = HUE_FG[m.hue];
                    const hbg = HUE_BG[m.hue];
                    const isPriority = e.priority === "high";
                    return (
                      <Pressable
                        key={i}
                        style={({ pressed }) => ({
                          flexDirection: "row", alignItems: "center", gap: 12,
                          paddingVertical: 12, paddingHorizontal: 14,
                          borderBottomWidth: i < evs.length - 1 ? 1 : 0,
                          borderBottomColor: t.line,
                          backgroundColor: pressed ? t.surface2 : "transparent",
                        })}
                      >
                        <Text style={{ minWidth: 44, fontSize: 11, fontWeight: "700", color: t.ink2, letterSpacing: 0.3 }}>
                          {e.t}
                        </Text>
                        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: hbg, alignItems: "center", justifyContent: "center" }}>
                          <Icon name={m.icon} size={15} color={hue} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600", color: t.ink, letterSpacing: -0.2 }}>{e.title}</Text>
                            {isPriority ? <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: t.danger }} /> : null}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                            {e.who ? <Text numberOfLines={1} style={{ fontSize: 11, color: t.ink3 }}>{e.who}</Text> : null}
                            {e.loan ? (
                              <>
                                {e.who ? <Text style={{ fontSize: 11, color: t.ink3 }}>·</Text> : null}
                                <Text style={{ fontSize: 11, color: t.ink2, fontWeight: "600" }}>{e.loan}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                        <Icon name="chevR" size={14} color={t.ink4} />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Fab onPress={() => {}} />
    </SafeAreaView>
  );
}
