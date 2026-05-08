import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { TopBar } from "@/components/TopBar";
import { NextActionCard } from "@/components/NextActionCard";
import { LoanSnapshotCard } from "@/components/LoanSnapshotCard";
import { DocumentRequestList } from "@/components/DocumentRequestList";
import { useCreditCurrent, useCurrentUser, useDocuments, useLoans, useMyClient } from "@/hooks/useApi";
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
  const activeLoan = useMemo(() => loans.find((l) => l.stage !== "funded") ?? loans[0] ?? null, [loans]);
  const { data: documents = [] } = useDocuments(activeLoan?.id);

  const nextAction = useMemo(
    () => deriveNextAction({ client, credit, loans, documents }),
    [client, credit, loans, documents]
  );

  const name = firstNameOf(user);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Home" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 4, marginBottom: 4 }}>
          <Text style={{ fontSize: 13, color: t.ink3, fontWeight: "600" }}>{greeting()}{name ? "," : ""}</Text>
          {name ? <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 2 }}>{name}</Text> : null}
        </View>

        <NextActionCard
          action={nextAction}
          onCtaOverride={nextAction.kind === "review_terms" ? () => router.push("/(tabs)/simulator") : undefined}
        />

        {activeLoan && <LoanSnapshotCard loan={activeLoan} onPress={() => router.push("/(tabs)/simulator")} />}

        <DocumentRequestList documents={documents} />
      </ScrollView>
    </SafeAreaView>
  );
}
