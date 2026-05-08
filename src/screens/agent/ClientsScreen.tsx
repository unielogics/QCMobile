import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Avatar, Card, Pill } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { StageFilterChips } from "@/components/agent/StageFilterChips";
import { useClients } from "@/hooks/useApi";
import { ClientStage, ClientStageOptions } from "@/lib/enums.generated";

const STAGE_LABEL: Record<ClientStage, string> = Object.fromEntries(
  ClientStageOptions.map((o) => [o.value, o.label])
) as Record<ClientStage, string>;

export function ClientsScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: clients = [], isLoading } = useClients("mine");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<ClientStage | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (stage && c.stage !== stage) return false;
      if (!q) return true;
      const hay = `${c.name} ${c.email ?? ""} ${c.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query, stage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Clients" />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.surface2, borderRadius: 10, paddingHorizontal: 12 }}>
          <Icon name="search" size={16} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, email, city"
            placeholderTextColor={t.ink4}
            style={{ flex: 1, color: t.ink, fontSize: 14, paddingVertical: 10 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Icon name="x" size={14} color={t.ink3} />
            </Pressable>
          ) : null}
        </View>
        <StageFilterChips
          options={ClientStageOptions as ReadonlyArray<{ value: ClientStage; label: string }>}
          selected={stage}
          onChange={setStage}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 96 }}>
        {isLoading && clients.length === 0 ? (
          <Card pad={18}><Text style={{ fontSize: 13, color: t.ink3 }}>Loading…</Text></Card>
        ) : filtered.length === 0 ? (
          <Card pad={18}>
            <Text style={{ fontSize: 13, color: t.ink2 }}>
              {query || stage ? "No clients match this filter." : "No clients in your book yet — add one to get started."}
            </Text>
          </Card>
        ) : (
          filtered.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/agent/client/${c.id}` as Href)}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingVertical: 12, paddingHorizontal: 14,
                backgroundColor: t.surface,
                borderColor: t.line, borderWidth: 1,
                borderRadius: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Avatar
                label={c.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                color={c.avatar_color ?? undefined}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink }} numberOfLines={1}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: t.ink3, marginTop: 2 }} numberOfLines={1}>
                  {c.city ?? c.email ?? "—"}
                  {c.fico != null ? ` · FICO ${c.fico}` : ""}
                </Text>
              </View>
              {c.stage ? <Pill bg={t.chip} color={t.ink2}>{STAGE_LABEL[c.stage]}</Pill> : null}
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/agent/client/new" as Href)}
        style={({ pressed }) => ({
          position: "absolute", right: 18, bottom: 24,
          backgroundColor: t.brand,
          paddingVertical: 13, paddingHorizontal: 18,
          borderRadius: 999,
          flexDirection: "row", alignItems: "center", gap: 6,
          shadowColor: "#0B1629", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name="plus" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Add Lead</Text>
      </Pressable>
    </SafeAreaView>
  );
}
