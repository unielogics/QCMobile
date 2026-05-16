// Fix & Flip Deal Analyzer — mobile, single-column. Shares the pure
// engine in src/lib/fixFlip with web. Hedged language only.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, SectionLabel } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { KeyboardAware } from "@/components/KeyboardAware";
import { useMyClient, useCreditCurrent, useSaveFixFlipScenario } from "@/hooks/useApi";
import { analyzeFixFlip } from "@/lib/fixFlip/calc";
import type { ExperienceTier, FixFlipInputs } from "@/lib/fixFlip/types";

const DISCLAIMER =
  "Estimates only. Final terms, cash to close, and eligibility depend on lender review, credit, title, appraisal, insurance, and the final settlement statement.";
const money = (x: number) => `$${Math.round(x).toLocaleString()}`;
const pctf = (x: number) => `${(x * 100).toFixed(1)}%`;

const EXPERIENCE: { v: ExperienceTier; l: string }[] = [
  { v: "0_flips", l: "First-time" },
  { v: "1_2_flips", l: "1-2 flips" },
  { v: "3_5_flips", l: "3-5 flips" },
  { v: "5_plus_flips", l: "5+ flips" },
  { v: "pro", l: "Pro" },
];

const DEFAULTS: FixFlipInputs = {
  address: { street: "", city: "", state: "", zip: "" },
  propertyType: "single_family",
  purchasePrice: 0,
  arv: 0,
  rehabCost: 0,
  rehabContingencyPct: 0.1,
  monthlyHoldingCost: 0,
  sellingCostPct: 0.06,
  closingCostPct: 0.02,
  constructionMonths: 4,
  monthsToSell: 3,
  experience: "1_2_flips",
};

export function DealAnalyzerScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const { data: client } = useMyClient();
  const { data: credit } = useCreditCurrent();
  const save = useSaveFixFlipScenario();
  const [i, setI] = useState<FixFlipInputs>(DEFAULTS);
  const [flash, setFlash] = useState<string | null>(null);

  const inputs = useMemo<FixFlipInputs>(
    () => ({
      ...i,
      creditScore:
        i.creditScore ??
        (credit as { fico?: number } | null)?.fico ??
        client?.fico ??
        undefined,
    }),
    [i, credit, client],
  );
  const result = useMemo(() => analyzeFixFlip(inputs), [inputs]);
  const ready = result.validationErrors.length === 0;

  const set = <K extends keyof FixFlipInputs>(k: K, v: FixFlipInputs[K]) =>
    setI((p) => ({ ...p, [k]: v }));
  const setAddr = (k: string, v: string) =>
    setI((p) => ({ ...p, address: { ...p.address, [k]: v } }));
  const num = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;

  const F = (label: string, value: number | string, on: (s: string) => void, ph?: string) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <TextInput
        value={value === 0 ? "" : String(value)}
        onChangeText={on}
        placeholder={ph}
        placeholderTextColor={t.ink4}
        keyboardType="numbers-and-punctuation"
        style={{ marginTop: 4, borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: t.ink, fontSize: 14, backgroundColor: t.surface2 }}
      />
    </View>
  );

  const onSave = async () => {
    try {
      await save.mutateAsync({
        status: "saved",
        payload: { inputs, result } as unknown as Record<string, unknown>,
        deal_score: result.dealScore,
        deal_grade: result.dealGrade,
      });
      setFlash("Scenario saved.");
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Couldn't save.");
    }
    setTimeout(() => setFlash(null), 3000);
  };

  const gradeC = (g: string) =>
    g === "Excellent" || g === "Good" ? t.brand : g === "Fair" || g === "Thin" ? t.warn : t.danger;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Icon name="x" size={18} color={t.ink} /></Pressable>
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>Deal Analyzer</Text>
      </View>
      <KeyboardAware excludeTabBar>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {flash ? <Text style={{ fontSize: 12.5, color: flash.includes("Couldn") ? t.danger : t.brand, fontWeight: "600" }}>{flash}</Text> : null}

          <Card pad={14}>
            <SectionLabel>Property</SectionLabel>
            {F("Street", inputs.address.street, (s) => setAddr("street", s))}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>{F("City", inputs.address.city, (s) => setAddr("city", s))}</View>
              <View style={{ flex: 1 }}>{F("State", inputs.address.state, (s) => setAddr("state", s.toUpperCase().slice(0, 2)))}</View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>{F("ZIP", inputs.address.zip, (s) => setAddr("zip", s))}</View>
              <View style={{ flex: 1 }}>{F("County", inputs.address.county ?? "", (s) => setAddr("county", s))}</View>
            </View>
          </Card>

          <Card pad={14}>
            <SectionLabel>Deal numbers</SectionLabel>
            {F("Purchase price / BRV", inputs.purchasePrice, (s) => set("purchasePrice", num(s)))}
            {F("After repair value (ARV)", inputs.arv, (s) => set("arv", num(s)))}
            {F("Rehab budget", inputs.rehabCost, (s) => set("rehabCost", num(s)))}
            {F("Rehab contingency %", inputs.rehabContingencyPct * 100, (s) => set("rehabContingencyPct", num(s) / 100), "10")}
            {F("Monthly holding cost", inputs.monthlyHoldingCost, (s) => set("monthlyHoldingCost", num(s)))}
          </Card>

          <Card pad={14}>
            <SectionLabel>Timeline</SectionLabel>
            {F("Construction months", inputs.constructionMonths, (s) => set("constructionMonths", num(s)))}
            {F("Months to sell", inputs.monthsToSell, (s) => set("monthsToSell", num(s)))}
            <Text style={{ fontSize: 12, color: t.ink3 }}>Total hold: <Text style={{ color: t.ink, fontWeight: "700" }}>{result.holdMonths} mo</Text></Text>
          </Card>

          <Card pad={14}>
            <SectionLabel>Borrower / credit</SectionLabel>
            {F("Credit score", inputs.creditScore ?? 0, (s) => set("creditScore", num(s) || undefined))}
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Experience</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {EXPERIENCE.map((x) => {
                const active = inputs.experience === x.v;
                return (
                  <Pressable key={x.v} onPress={() => set("experience", x.v)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: active ? t.brand : t.line, backgroundColor: active ? t.brandSoft : t.surface2 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? t.brand : t.ink2 }}>{x.l}</Text>
                  </Pressable>
                );
              })}
            </View>
            {F("Liquidity available", inputs.liquidity ?? 0, (s) => set("liquidity", num(s) || undefined))}
          </Card>

          {!ready ? (
            <Card pad={16}>
              <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>Enter the deal to see results</Text>
              {result.validationErrors.map((e) => (
                <Text key={e} style={{ fontSize: 12.5, color: t.warn, marginTop: 4 }}>• {e}</Text>
              ))}
            </Card>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Stat t={t} label="Deal grade" value={result.dealGrade} sub={`Score ${result.dealScore}/100`} c={gradeC(result.dealGrade)} />
                <Stat t={t} label="Net profit" value={money(result.projectedNetProfit)} sub={pctf(result.profitMargin)} c={result.projectedNetProfit > 0 ? t.brand : t.danger} />
                <Stat t={t} label="Cash to close" value={money(result.estimatedCashToClose)} sub={`CoC ${pctf(result.cashOnCashReturn)}`} />
                <Stat t={t} label="Loan amount" value={money(result.loanAmount)} />
                <Stat t={t} label="Best program" value={result.bestProgram?.name ?? "Needs review"} sub={result.bestProgram ? "Potential fit" : ""} />
                <Stat t={t} label="Max safe price" value={money(result.maxSafePurchasePrice)} sub={`Purchase: ${result.purchasePriceGrade}`} c={gradeC(result.purchasePriceGrade)} />
              </View>

              <Card pad={14}>
                <SectionLabel>Explanation</SectionLabel>
                <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>{result.explanation}</Text>
                {result.warnings.map((w) => (
                  <Text key={w} style={{ fontSize: 12.5, color: t.warn, marginTop: 6 }}>⚠ {w}</Text>
                ))}
              </Card>

              <Card pad={14}>
                <SectionLabel>Loan programs</SectionLabel>
                {result.eligiblePrograms.length === 0 ? (
                  <Text style={{ fontSize: 13, color: t.ink3 }}>No clear fit under current rules.</Text>
                ) : result.eligiblePrograms.map((f) => (
                  <View key={f.program.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: t.ink }}>{f.program.name}</Text>
                      <Text style={{ fontSize: 11.5, color: t.ink3 }}>{(f.program.interestRate * 100).toFixed(2)}% · {f.program.points} pts · {f.program.termMonths}mo</Text>
                    </View>
                    {result.bestProgram?.id === f.program.id ? <Pill bg={t.brandSoft} color={t.brand}>Best</Pill> : null}
                    <Text style={{ fontSize: 12, color: t.ink2 }}>{money(f.estimatedCashToClose)}</Text>
                  </View>
                ))}
                {result.ineligiblePrograms.map((f) => (
                  <View key={f.program.id} style={{ paddingVertical: 6 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: t.ink2 }}>{f.program.name}</Text>
                    <Text style={{ fontSize: 11.5, color: t.danger }}>{(f.reasons ?? []).join(" · ")}</Text>
                  </View>
                ))}
              </Card>

              <Card pad={14}>
                <SectionLabel>Sensitivity</SectionLabel>
                {result.sensitivity.map((s) => (
                  <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                    <Text style={{ flex: 1, fontSize: 12.5, color: t.ink2 }}>{s.label}</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: s.netProfit > 0 ? t.ink : t.danger }}>{money(s.netProfit)}</Text>
                    <Pill bg={t.chip} color={gradeC(s.grade)}>{s.grade}</Pill>
                  </View>
                ))}
              </Card>

              <Card pad={14}>
                <SectionLabel>Make this deal work</SectionLabel>
                {result.recommendations.map((r) => (
                  <Text key={r} style={{ fontSize: 13, color: t.ink2, marginTop: 4, lineHeight: 18 }}>• {r}</Text>
                ))}
              </Card>

              <Pressable onPress={onSave} disabled={save.isPending} style={{ backgroundColor: save.isPending ? t.chip : t.brand, paddingVertical: 14, borderRadius: 12, alignItems: "center" }}>
                <Text style={{ color: save.isPending ? t.ink4 : "#fff", fontWeight: "800", fontSize: 14 }}>{save.isPending ? "Saving…" : "Save Scenario"}</Text>
              </Pressable>

              <Text style={{ fontSize: 11, color: t.ink3 }}>{DISCLAIMER}</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAware>
    </SafeAreaView>
  );
}

function Stat({ t, label, value, sub, c }: { t: ReturnType<typeof useTheme>["t"]; label: string; value: string; sub?: string; c?: string }) {
  return (
    <Card pad={12} style={{ width: "47%" }}>
      <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "800", color: c ?? t.ink, marginTop: 3 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{sub}</Text> : null}
    </Card>
  );
}
