// Messages tab — borrower's unified AI chat surface.
//
// Two-tier layout:
//   1. Account / general thread (loan_id=null) at the top — covers
//      cross-portfolio questions ("what's my FICO?", "what's
//      blocking me?")
//   2. One row per loan the borrower has, lazy-created on tap
//
// Tapping a row opens the existing AIChatSheet locked to that
// thread (skipping its built-in thread-switcher). Auto-triggered AI
// messages — doc-scan reactions, doc-overdue nudges — land in the
// right thread automatically and surface here on the next refetch.

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { AIChatSheet } from "@/components/sheets/AIChatSheet";
import {
  useAIChatThreads,
  useFindOrCreateChatThread,
  useLoans,
} from "@/hooks/useApi";
import type { AIChatThread, Loan } from "@/lib/types";

export default function MessagesScreen() {
  const { t } = useTheme();
  const { data: loans = [] } = useLoans();
  const { data: threads = [], isLoading: threadsLoading, refetch: refetchThreads, isRefetching } = useAIChatThreads();
  const findOrCreate = useFindOrCreateChatThread();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const openThread = async (loan_id: string | null) => {
    setError(null);
    const existing = loan_id == null ? accountThread : loanThreadMap.get(loan_id);
    if (existing) {
      setActiveThreadId(existing.id);
      setChatVisible(true);
      return;
    }
    try {
      const created = await findOrCreate.mutateAsync({ loan_id });
      setActiveThreadId(created.id);
      setChatVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the thread.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Messages" />
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 80, gap: 10 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetchThreads()} tintColor={t.ink3} />
        }
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
          Conversations
        </Text>
        <Text style={{ fontSize: 12, color: t.ink3, lineHeight: 17, marginBottom: 6 }}>
          Account thread for general questions. Each loan has its own thread.
        </Text>

        {threadsLoading ? (
          <Card pad={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={t.ink3} />
              <Text style={{ fontSize: 12, color: t.ink3 }}>Loading…</Text>
            </View>
          </Card>
        ) : null}

        {/* Account / general thread row */}
        <ThreadRow
          t={t}
          title="Account questions"
          subtitle={accountThread?.last_message_preview ?? "General questions about your portfolio."}
          timestamp={accountThread?.last_message_at ?? null}
          empty={!accountThread}
          accent="petrol"
          onPress={() => openThread(null)}
        />

        {loans.length > 0 ? (
          <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 12, marginBottom: 4 }}>
            Loans
          </Text>
        ) : null}

        {loans.map((loan: Loan) => {
          const th = loanThreadMap.get(loan.id);
          return (
            <ThreadRow
              key={loan.id}
              t={t}
              title={loan.deal_id}
              subtitleHeader={loan.address ?? ""}
              subtitle={th?.last_message_preview ?? "No conversation yet — tap to start."}
              timestamp={th?.last_message_at ?? null}
              empty={!th}
              accent="brand"
              onPress={() => openThread(loan.id)}
            />
          );
        })}

        {error ? (
          <Card pad={12}>
            <Pill bg={t.dangerBg} color={t.danger}>{error}</Pill>
          </Card>
        ) : null}

        {!threadsLoading && loans.length === 0 && !accountThread ? (
          <Card pad={16}>
            <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>
              No active loans yet. Tap the Account thread above to ask anything —
              the AI sees your full profile and can guide you through your next
              steps.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <AIChatSheet
        visible={chatVisible}
        initialThreadId={activeThreadId}
        onClose={() => setChatVisible(false)}
      />
    </SafeAreaView>
  );
}

function ThreadRow({
  t,
  title,
  subtitleHeader,
  subtitle,
  timestamp,
  empty,
  accent,
  onPress,
}: {
  t: ReturnType<typeof useTheme>["t"];
  title: string;
  subtitleHeader?: string;
  subtitle: string;
  timestamp: string | null;
  empty: boolean;
  accent: "petrol" | "brand";
  onPress: () => void;
}) {
  const accentColor = accent === "petrol" ? t.petrol : t.brand;
  const accentBg = accent === "petrol" ? t.petrolSoft : t.brandSoft;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card pad={14}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
              <Text
                style={{ fontSize: 13.5, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}
                numberOfLines={1}
              >
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
        </View>
      </Card>
    </Pressable>
  );
}
