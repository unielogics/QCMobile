import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { TopBar } from "@/components/TopBar";
import { NextActionCard } from "@/components/NextActionCard";
import { LoanSnapshotCard } from "@/components/LoanSnapshotCard";
import { DocumentRequestList } from "@/components/DocumentRequestList";
import { AIChatSheet } from "@/components/sheets/AIChatSheet";
import { Icon } from "@/design-system/Icon";
import {
  useAIChatThreads,
  useCreditCurrent,
  useCurrentUser,
  useDocuments,
  useLoans,
  useMyClient,
} from "@/hooks/useApi";
import { deriveNextAction } from "@/lib/nextAction";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(user: { name?: string; email?: string } | null | undefined): string | null {
  if (!user) return null;
  const n = (user.name ?? "").trim();
  if (n && n !== user.email) return n.split(" ")[0];
  if (user.email) return user.email.split("@")[0].split(".")[0];
  return null;
}

export function GuidedHome() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { data: client } = useMyClient();
  const { data: credit } = useCreditCurrent();
  const { data: loans = [] } = useLoans();
  const activeLoan = useMemo(
    () => loans.find((l) => l.stage !== "funded") ?? loans[0] ?? null,
    [loans],
  );
  const { data: documents = [] } = useDocuments(activeLoan?.id);
  // Threads drive the unread indicator + "last message" preview on the
  // chat hero card. Cheap query — the existing AIChatSheet already
  // uses the same hook so this is cached.
  const { data: threads = [] } = useAIChatThreads();

  const nextAction = useMemo(
    () => deriveNextAction({ client, credit, loans, documents }),
    [client, credit, loans, documents],
  );

  const name = firstNameOf(user);
  const [chatOpen, setChatOpen] = useState(false);

  // Pick the most recent thread for a preview message + unread badge.
  // The chat hero is the focal point in Guided mode — borrowers should
  // see "where the conversation is" before anything else on the screen.
  const primary = useMemo(() => {
    const sorted = [...threads].sort((a, b) =>
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
    );
    return sorted[0] ?? null;
  }, [threads]);
  const hasUnread = threads.some((th) => th.unread === true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Home" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
        {/* Greeting kept slim so the chat hero is what the eye lands on. */}
        <View style={{ paddingHorizontal: 4, marginBottom: 2 }}>
          <Text style={{ fontSize: 13, color: t.ink3, fontWeight: "600" }}>
            {greeting()}{name ? "," : ""}
          </Text>
          {name ? (
            <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 2 }}>
              {name}
            </Text>
          ) : null}
        </View>

        {/* PRIMARY: AI Concierge chat hero. In Guided mode the chat is
            the main interface — borrowers move through their file by
            replying to the AI, not by tab-hunting. Big, tappable, with
            unread badge + last-message preview when available. */}
        <ChatHeroCard
          t={t}
          unread={hasUnread}
          preview={primary?.last_message_preview ?? null}
          lastAt={primary?.last_message_at ?? null}
          onPress={() => setChatOpen(true)}
        />

        {/* Secondary surfaces. Smaller, below the fold so they're
            accessible without competing with the chat. */}
        <NextActionCard
          action={nextAction}
          onCtaOverride={
            nextAction.kind === "review_terms"
              ? () => router.push("/(tabs)/simulator")
              : undefined
          }
        />

        {activeLoan && (
          <LoanSnapshotCard
            loan={activeLoan}
            onPress={() => router.push("/(tabs)/simulator")}
          />
        )}

        <DocumentRequestList documents={documents} />
      </ScrollView>

      <AIChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        context="From your dashboard"
        initialThreadId={primary?.id ?? null}
      />
    </SafeAreaView>
  );
}


// AI Concierge hero card — the primary affordance on Guided home.
// Renders large, brand-tinted, with a chat icon, last-message preview
// (or a starter prompt when there's no history yet), an unread dot,
// and relative timestamp. Tapping anywhere opens AIChatSheet.
function ChatHeroCard({
  t,
  unread,
  preview,
  lastAt,
  onPress,
}: {
  t: ReturnType<typeof useTheme>["t"];
  unread: boolean;
  preview: string | null;
  lastAt: string | null;
  onPress: () => void;
}) {
  const subtitle = preview
    ? preview
    : "Tap to talk to your AI concierge — ask about docs, status, or what's next.";
  const ts = relativeTime(lastAt);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 16,
        backgroundColor: t.brand,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 4,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "rgba(255,255,255,0.18)",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Icon name="chat" size={26} color={t.inverse} stroke={2.2} />
        {unread ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: t.danger,
              borderWidth: 2,
              borderColor: t.brand,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 1.0 }}>
            AI CONCIERGE
          </Text>
          {ts ? (
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>· {ts}</Text>
          ) : null}
        </View>
        <Text
          style={{ fontSize: 16, fontWeight: "800", color: t.inverse, marginTop: 3 }}
          numberOfLines={1}
        >
          {preview ? "Continue your conversation" : "Start a conversation"}
        </Text>
        <Text
          style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, lineHeight: 18 }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <Icon name="chevR" size={20} color={t.inverse} />
    </Pressable>
  );
}

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return null;
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
