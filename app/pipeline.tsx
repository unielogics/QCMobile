// Borrower-facing pipeline list — full inventory of the user's loans.
// Reached from the Home tab's "Your loans" header (which only shows
// the top-3 cards). Tapping a row opens the loan detail screen.
//
// Operators on mobile (rare; they live on desktop) see the same list,
// scoped to whatever loans the backend returns for their role.

import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, StageBadge } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { QC_FMT } from "@/design-system/tokens";
import { TopBar } from "@/components/TopBar";
import { useLoans } from "@/hooks/useApi";
import type { Loan } from "@/lib/types";

const STAGE_KEYS = ["prequalified", "collecting_docs", "lender_connected", "processing", "closing", "funded"] as const;
const TYPE_ICON: Record<string, string> = {
  fix_and_flip: "hammer",
  ground_up: "building2",
  dscr: "key",
  bridge: "bolt",
  portfolio: "layers",
  cash_out_refi: "refresh",
};
const TYPE_LABEL: Record<string, string> = {
  fix_and_flip: "Fix & Flip",
  ground_up: "Ground Up",
  dscr: "DSCR",
  bridge: "Bridge",
  portfolio: "Portfolio",
  cash_out_refi: "Cash-Out",
};

export default function PipelinePage() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: loans = [], isLoading } = useLoans();

  const inFlight = useMemo(() => loans.filter((l) => l.stage !== "funded"), [loans]);
  const funded = useMemo(() => loans.filter((l) => l.stage === "funded"), [loans]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Pipeline" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginTop: 4, marginBottom: 8 }}>
          <Text style={{ color: t.brand, fontWeight: "700", fontSize: 14 }}>‹ Back</Text>
        </Pressable>

        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, letterSpacing: -0.4 }}>
            Your loans
          </Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginTop: 4 }}>
            {loans.length === 0
              ? "No loans on file yet."
              : `${inFlight.length} active · ${funded.length} funded · ${loans.length} total`}
          </Text>
        </View>

        {isLoading && loans.length === 0 ? (
          <Card pad={20}>
            <Text style={{ fontSize: 13, color: t.ink3 }}>Loading…</Text>
          </Card>
        ) : loans.length === 0 ? (
          <Card pad={20}>
            <Text style={{ fontSize: 13, color: t.ink3, textAlign: "center" }}>
              No loans yet. Start one from Home.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {loans.map((loan) => (
              <PipelineRow key={loan.id} loan={loan} onPress={() => router.push(`/loan/${loan.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PipelineRow({ loan, onPress }: { loan: Loan; onPress: () => void }) {
  const { t } = useTheme();
  const stageIdx = Math.max(0, STAGE_KEYS.indexOf(loan.stage));
  const typeLabel = TYPE_LABEL[loan.type] ?? loan.type.replace(/_/g, " ");
  const iconName = TYPE_ICON[loan.type] ?? "doc";

  return (
    <Card pad={14} onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View
          style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name={iconName} size={18} color={t.brand} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "monospace", fontSize: 11, fontWeight: "700", color: t.ink3 }}>
              {loan.deal_id}
            </Text>
            <StageBadge stage={stageIdx} />
          </View>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: t.ink, letterSpacing: -0.2, marginTop: 4 }}>
            {loan.address}
          </Text>
          <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
            {QC_FMT.short(Number(loan.amount))} · {typeLabel}
            {loan.city ? ` · ${loan.city}` : ""}
          </Text>
        </View>
        <Icon name="chevR" size={14} color={t.ink4} />
      </View>
    </Card>
  );
}
