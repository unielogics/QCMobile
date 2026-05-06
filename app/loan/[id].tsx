import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useState } from "react";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Stepper, StepperLabels } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { Slider } from "@/design-system/Slider";
import { QC_FMT } from "@/design-system/tokens";
import { useLoan, useLoanActivity, useDocuments, useAIChat, useLoans, useMyCredit } from "@/hooks/useApi";
import type { AIChatTurn, Document } from "@/lib/types";
import { computeEligibility, computeSimulator, ltvLabel, type EligibilityBanner } from "@/lib/eligibility";

const STAGE_KEYS = ["prequalified", "collecting_docs", "lender_connected", "processing", "closing", "funded"] as const;
const PIPELINE_STAGES = ["Prequalified", "Processing", "Underwriting", "Closing", "Funded"];
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

const TABS = [
  { id: "activity", label: "Activity",   icon: "flag" },
  { id: "chat",     label: "AI Chat",    icon: "chat" },
  { id: "docs",     label: "Documents",  icon: "doc" },
  { id: "sim",      label: "Simulation", icon: "sliders" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function LoanFile() {
  const { t, isDark } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: loan } = useLoan(id);
  const [tab, setTab] = useState<TabId>("activity");

  if (!loan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
        <Text style={{ color: t.ink3 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const stageIdx = Math.max(0, STAGE_KEYS.indexOf(loan.stage));
  const stagePos = Math.min(4, Math.floor((stageIdx / (STAGE_KEYS.length - 1)) * 4));
  const typeLabel = TYPE_LABEL[loan.type] ?? loan.type.replace("_", " ");
  const iconName = TYPE_ICON[loan.type] ?? "doc";
  const closeStr = loan.close_date
    ? new Date(loan.close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            alignSelf: "flex-start",
            flexDirection: "row", alignItems: "center", gap: 4,
            paddingVertical: 6, paddingHorizontal: 10,
            borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line,
          }}
        >
          <Icon name="arrowL" size={14} color={t.ink2} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: t.ink2 }}>Pipeline</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Card pad={16}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.brandSoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name={iconName} size={22} color={t.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: t.ink, letterSpacing: -0.3 }}>{loan.address}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11.5, color: t.ink3, marginTop: 2 }}>
                {loan.city ?? "—"} · {typeLabel} · {loan.deal_id}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: t.ink, letterSpacing: -0.4 }}>{QC_FMT.short(Number(loan.amount))}</Text>
              <Text style={{ fontSize: 10.5, color: t.ink3, fontWeight: "600" }}>Close {closeStr}</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Stepper stages={PIPELINE_STAGES} current={stagePos} />
            <StepperLabels stages={PIPELINE_STAGES} current={stagePos} />
          </View>
        </Card>
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: t.chip, borderRadius: 12, padding: 3 }}>
          {TABS.map((opt) => {
            const active = tab === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setTab(opt.id)}
                style={{
                  flex: 1, paddingVertical: 9, borderRadius: 9,
                  backgroundColor: active ? t.surface : "transparent",
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <Icon name={opt.icon} size={13} color={active ? t.ink : t.ink3} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? t.ink : t.ink3 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === "activity" && <ActivityPane loanId={loan.id} />}
      {tab === "chat" && <ChatPane loanId={loan.id} dealId={loan.deal_id} />}
      {tab === "docs" && <DocsPane loanId={loan.id} />}
      {tab === "sim" && (
        <SimulationPane
          loanType={loan.type}
          arv={loan.arv != null ? Number(loan.arv) : null}
          ltv={loan.ltv}
          discountPoints={loan.discount_points}
        />
      )}
    </SafeAreaView>
  );
}

function ActivityPane({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data: activity = [], isLoading } = useLoanActivity(loanId);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
      {isLoading ? <Text style={{ color: t.ink3, fontSize: 13 }}>Loading activity…</Text> : null}
      {!isLoading && activity.length === 0 ? (
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>No activity yet for this loan.</Text>
        </Card>
      ) : null}
      {activity.map((e) => (
        <Card key={e.id} pad={14}>
          <Text style={{ fontSize: 11, color: t.ink3, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }) }}>
            {new Date(e.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </Text>
          <Text style={{ fontSize: 14, color: t.ink, fontWeight: "600", marginTop: 4 }}>{e.summary}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.chip }}>
              <Text style={{ fontSize: 10.5, fontWeight: "600", color: t.ink2 }}>{e.kind}</Text>
            </View>
            {e.actor_label ? <Text style={{ fontSize: 11, color: t.ink3 }}>{e.actor_label}</Text> : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function ChatPane({ loanId, dealId }: { loanId: string; dealId: string }) {
  const { t } = useTheme();
  const chat = useAIChat();
  const [messages, setMessages] = useState<AIChatTurn[]>([]);
  const [draft, setDraft] = useState("");

  const send = async () => {
    const text = draft.trim();
    if (!text || chat.isPending) return;
    const next: AIChatTurn[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    try {
      const reply = await chat.mutateAsync({ messages: next, loan_id: loanId });
      setMessages([...next, { role: "assistant", content: reply.reply }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", content: `(error: ${err instanceof Error ? err.message : "request failed"})` }]);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <Card pad={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon name="spark" size={14} color={t.petrol} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: t.petrol, letterSpacing: 1.2, textTransform: "uppercase" }}>AI Co-pilot · {dealId}</Text>
            </View>
            <Text style={{ color: t.ink3, fontSize: 13, lineHeight: 18 }}>
              Ask anything about your loan — pricing, missing docs, next steps. The assistant has full context for this file.
            </Text>
          </Card>
        ) : null}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "84%",
              backgroundColor: m.role === "user" ? t.brandSoft : t.surface2,
              borderColor: t.line, borderWidth: 1,
              borderRadius: 14, padding: 12,
            }}
          >
            <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
              {m.role === "user" ? "You" : "AI"}
            </Text>
            <Text style={{ fontSize: 14, color: t.ink, lineHeight: 20 }}>{m.content}</Text>
          </View>
        ))}
        {chat.isPending ? (
          <View style={{ alignSelf: "flex-start", padding: 12 }}>
            <ActivityIndicator color={t.ink3} />
          </View>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.surface }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about this loan…"
          placeholderTextColor={t.ink3}
          multiline
          style={{
            flex: 1, fontSize: 14, color: t.ink,
            backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line,
            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120,
          }}
        />
        <Pressable
          onPress={send}
          disabled={chat.isPending || !draft.trim()}
          style={({ pressed }) => ({
            paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
            backgroundColor: chat.isPending || !draft.trim() ? t.chip : t.ink,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name="send" size={16} color={chat.isPending || !draft.trim() ? t.ink4 : t.inverse} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function DocsPane({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data: docs = [], isLoading } = useDocuments(loanId);

  const counts = useMemo(() => ({
    received:  docs.filter((d) => d.status === "received" || d.status === "verified").length,
    requested: docs.filter((d) => d.status === "requested").length,
    pending:   docs.filter((d) => d.status === "pending").length,
    flagged:   docs.filter((d) => d.status === "flagged").length,
  }), [docs]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
      <Card pad={14}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.6, textTransform: "uppercase" }}>
            Document Vault · {docs.length} items
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <Counter label="Received" count={counts.received} color={t.profit} />
          <Counter label="Requested" count={counts.requested} color={t.brand} />
          <Counter label="Pending" count={counts.pending} color={t.warn} />
          <Counter label="Flagged" count={counts.flagged} color={t.danger} />
        </View>
      </Card>
      {isLoading ? <Text style={{ color: t.ink3, fontSize: 13 }}>Loading documents…</Text> : null}
      {!isLoading && docs.length === 0 ? (
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>No documents on file yet.</Text>
        </Card>
      ) : null}
      {docs.map((d) => <DocRow key={d.id} doc={d} />)}
    </ScrollView>
  );
}

function DocRow({ doc }: { doc: Document }) {
  const { t } = useTheme();
  const statusBg = doc.status === "verified" ? t.profitBg : doc.status === "received" ? t.brandSoft : doc.status === "flagged" ? t.dangerBg : t.warnBg;
  const statusFg = doc.status === "verified" ? t.profit : doc.status === "received" ? t.brand : doc.status === "flagged" ? t.danger : t.warn;
  return (
    <Card pad={12}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="doc" size={16} color={t.ink3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{doc.name}</Text>
          <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
            {doc.category ?? "uncategorized"}
            {doc.requested_on ? ` · requested ${new Date(doc.requested_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            {doc.received_on ? ` · received ${new Date(doc.received_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </Text>
        </View>
        <View style={{ paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: statusBg }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", color: statusFg, textTransform: "uppercase", letterSpacing: 0.4 }}>{doc.status}</Text>
        </View>
      </View>
    </Card>
  );
}

function Counter({ label, count, color }: { label: string; count: number; color: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: t.ink3, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: t.ink, fontWeight: "800" }}>{count}</Text>
    </View>
  );
}

// Map backend loan type → simulator product key
function productKeyFor(loanType: string): "dscr" | "ff" | "gu" | "br" {
  if (loanType === "dscr") return "dscr";
  if (loanType === "fix_and_flip") return "ff";
  if (loanType === "ground_up") return "gu";
  return "br";
}

function SimulationPane({
  loanType, arv, ltv, discountPoints,
}: {
  loanType: string;
  arv: number | null;
  ltv: number | null;
  discountPoints: number;
}) {
  const router = useRouter();
  const { data: credit } = useMyCredit();
  const { data: loans = [] } = useLoans();

  // Experience derivation:
  //   propertyCount      = total loans the borrower has on record (any stage)
  //   hasYearOfOwnership = at least one funded loan more than ~365 days old
  const propertyCount = loans.length;
  const hasYearOfOwnership = useMemo(() => {
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return loans.some((l) => l.stage === "funded" && l.close_date && (now - new Date(l.close_date).getTime()) >= oneYearMs);
  }, [loans]);

  const eligibility = computeEligibility({
    fico: credit?.fico ?? null,
    propertyCount,
    hasYearOfOwnership,
  });

  const productKey = productKeyFor(loanType);

  // ARV input — pre-populated from the loan record, but editable as a "what-if".
  const [arvText, setArvText] = useState(arv ? String(Math.round(arv)) : "");
  const arvNum = Number(arvText.replace(/[^0-9.]/g, "")) || 0;

  // Discount points — slider 0–2% in 0.25 steps
  const [points, setPoints] = useState(Math.min(2, Math.max(0, discountPoints || 0)));

  // LTV — slider 60–75 in 1% steps, gated by eligibility
  const initialLtvPct = ltv ? Math.round(ltv * 100) : 65;
  const [ltvPct, setLtvPct] = useState(Math.min(eligibility.maxLTV * 100 || 65, Math.max(60, initialLtvPct)));

  const ltvFraction = ltvPct / 100;
  const isBlocked = eligibility.tier === "blocked";

  const sim = useMemo(() => {
    if (isBlocked || arvNum <= 0) return null;
    return computeSimulator({ arv: arvNum, ltv: ltvFraction, discountPoints: points, productKey });
  }, [isBlocked, arvNum, ltvFraction, points, productKey]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }} showsVerticalScrollIndicator={false}>
      {/* Eligibility banner */}
      {eligibility.banner ? (
        <EligibilityBannerCard
          banner={eligibility.banner}
          onCta={(target) => {
            if (target === "credit-pull") router.push("/credit-pull");
            if (target === "vault") router.push("/(tabs)/vault");
            if (target === "new-loan") router.push("/(tabs)");
          }}
        />
      ) : null}

      {/* Property + ARV */}
      <Card pad={14}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7891", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>
          Property
        </Text>
        <ArvField value={arvText} onChange={setArvText} />
      </Card>

      {/* Discount points slider */}
      <Card pad={14}>
        <SliderHeader
          label="Discount Points"
          value={`${points.toFixed(2)} pts`}
          hint={points > 0 ? `−${Math.round(points * 25)} bps off base rate` : "No buy-down · base rate"}
          disabled={isBlocked}
        />
        <Slider
          value={points}
          min={0}
          max={2}
          step={0.25}
          onChange={isBlocked ? () => {} : setPoints}
          markers={[
            { value: 0, label: "0" },
            { value: 0.5, label: "0.5" },
            { value: 1, label: "1" },
            { value: 1.5, label: "1.5" },
            { value: 2, label: "2" },
          ]}
        />
      </Card>

      {/* LTV slider with gating */}
      <Card pad={14}>
        <SliderHeader
          label="Loan-to-ARV"
          value={`${ltvPct}%`}
          hint={ltvLabel(ltvFraction)}
          disabled={isBlocked}
        />
        <Slider
          value={ltvPct}
          min={60}
          max={75}
          step={1}
          onChange={isBlocked ? () => {} : setLtvPct}
          gatedMax={isBlocked ? 60 : eligibility.maxLTV * 100}
          markers={eligibility.allLTVs.map((v) => ({
            value: Math.round(v * 100),
            label: `${Math.round(v * 100)}%`,
          }))}
        />
        {!isBlocked && eligibility.maxLTV < 0.75 ? (
          <Text style={{ fontSize: 11, color: "#6B7891", marginTop: 6 }}>
            70% and 75% locked at this tier.
          </Text>
        ) : null}
      </Card>

      {/* Result */}
      {sim ? (
        <Card pad={14}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7891", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>
            Simulated terms
          </Text>
          <ResultGrid
            sim={sim}
            isDscr={productKey === "dscr"}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

// ── Bannercard — surfaces eligibility messaging with a contextual CTA. ───
function EligibilityBannerCard({
  banner,
  onCta,
}: {
  banner: EligibilityBanner;
  onCta: (target: NonNullable<EligibilityBanner["ctaTarget"]>) => void;
}) {
  const { t, isDark } = useTheme();
  const palette = (() => {
    switch (banner.kind) {
      case "credit-blocked":
        return { bg: t.dangerBg, fg: t.danger, icon: "lock" as const };
      case "credit-warn":
        return { bg: t.warnBg, fg: t.warn, icon: "alert" as const };
      case "experience":
        return { bg: t.petrolSoft, fg: t.petrol, icon: "trend" as const };
      case "no-credit":
        return { bg: t.brandSoft, fg: t.brand, icon: "shield" as const };
    }
  })();

  return (
    <Card pad={14} style={{ backgroundColor: palette.bg, borderColor: `${palette.fg}40` }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.fg, alignItems: "center", justifyContent: "center" }}>
          <Icon name={palette.icon} size={18} color={isDark ? "#06070B" : "#fff"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: palette.fg, letterSpacing: 0.4, textTransform: "uppercase" }}>
            {banner.title}
          </Text>
          <Text style={{ fontSize: 12, color: t.ink2, marginTop: 4, lineHeight: 17 }}>
            {banner.body}
          </Text>
          {banner.ctaLabel && banner.ctaTarget ? (
            <Pressable
              onPress={() => onCta(banner.ctaTarget!)}
              style={({ pressed }) => ({
                marginTop: 10, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9,
                backgroundColor: palette.fg,
                alignSelf: "flex-start",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#06070B" : "#fff" }}>
                {banner.ctaLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function ArvField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTheme();
  const num = Number(value.replace(/[^0-9.]/g, "")) || 0;
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
        ARV (After Repair Value)
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.lineStrong, borderRadius: 11, backgroundColor: t.surface2, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink3, marginRight: 4 }}>$</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="500000"
          placeholderTextColor={t.ink4}
          style={{ flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: "700", color: t.ink }}
        />
        <Text style={{ fontSize: 12, color: t.ink3, marginLeft: 8 }}>{num >= 1000 ? QC_FMT.short(num) : ""}</Text>
      </View>
      <Text style={{ fontSize: 11, color: t.ink3, marginTop: 6 }}>
        Loan amount is computed from ARV × LTV.
      </Text>
    </View>
  );
}

function SliderHeader({ label, value, hint, disabled }: { label: string; value: string; hint?: string; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
      <View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: disabled ? t.ink4 : t.ink2 }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 10.5, color: t.ink4, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      <Text style={{ fontSize: 18, fontWeight: "800", color: disabled ? t.ink4 : t.ink, letterSpacing: -0.3 }}>
        {value}
      </Text>
    </View>
  );
}

function ResultGrid({ sim, isDscr }: { sim: ReturnType<typeof computeSimulator>; isDscr: boolean }) {
  const { t } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Loan amount</Text>
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>{QC_FMT.usd(sim.loanAmount, 0)}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Final rate</Text>
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.brand }}>{(sim.rate * 100).toFixed(3)}%</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Monthly P&I</Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink }}>{QC_FMT.usd(sim.monthlyPI, 0)}</Text>
      </View>
      {isDscr && sim.dscr != null ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>DSCR</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: sim.dscr > 1.25 ? t.profit : sim.dscr > 1 ? t.warn : t.danger }}>
            {sim.dscr.toFixed(2)}
          </Text>
        </View>
      ) : null}
      {isDscr && sim.cashFlow != null ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>Est. cash flow</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: sim.cashFlow > 0 ? t.profit : t.danger }}>
            {sim.cashFlow > 0 ? "+" : ""}{QC_FMT.usd(sim.cashFlow, 0)}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.line }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Discount points cost</Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink }}>{QC_FMT.usd(sim.pointsCost, 0)}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
        <Text style={{ fontSize: 13, color: t.ink2 }}>Estimated cash to close</Text>
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>{QC_FMT.usd(sim.totalToClose, 0)}</Text>
      </View>
    </View>
  );
}

function RateStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ minWidth: 110 }}>
      <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: "800", color: accent ?? t.ink, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function RateRow({ label, value, bold, last }: { label: string; value: string; bold?: boolean; last?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <Text style={{ fontSize: 13, color: t.ink2 }}>{label}</Text>
      <Text style={{ fontSize: bold ? 16 : 14, fontWeight: bold ? "800" : "700", color: t.ink }}>{value}</Text>
    </View>
  );
}
