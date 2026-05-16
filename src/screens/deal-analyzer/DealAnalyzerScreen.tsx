// Fix & Flip Deal Analyzer — mobile, paginated wizard. Borrower credit
// + experience are DERIVED from the profile (read-only pills), never
// typed. Shares the pure engine in src/lib/fixFlip with web.

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
import { US_STATES } from "@/lib/usStates";
import type { ExperienceTier, FixFlipInputs } from "@/lib/fixFlip/types";

const DISCLAIMER =
  "Estimates only. Final terms, cash to close, and eligibility depend on lender review, credit, title, appraisal, insurance, and the final settlement statement.";
const money = (x: number) => `$${Math.round(x).toLocaleString()}`;
const pctf = (x: number) => `${(x * 100).toFixed(1)}%`;

const EXP_LABEL: Record<ExperienceTier, string> = {
  "0_flips": "First-time investor",
  "1_2_flips": "1-2 completed flips",
  "3_5_flips": "3-5 completed flips",
  "5_plus_flips": "5+ completed flips",
  pro: "Professional operator",
};

function deriveExperienceTier(raw?: string | null): ExperienceTier {
  const s = (raw ?? "").toLowerCase();
  if (/pro\b|professional|operator/.test(s)) return "pro";
  if (/first|brand new|\bnone\b|\b0\b|no experience/.test(s)) return "0_flips";
  if (/\b([5-9]|\d{2,})\b|\b5\s*\+/.test(s)) return "5_plus_flips";
  if (/\b[3-4]\b/.test(s)) return "3_5_flips";
  if (/\b[1-2]\b|\bone\b|\btwo\b/.test(s)) return "1_2_flips";
  return "1_2_flips";
}

const STEPS = ["Property", "Deal Numbers", "Timeline & Cash", "Review", "Results"] as const;
type Step = (typeof STEPS)[number];

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
  const [stepIdx, setStepIdx] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  const step: Step = STEPS[stepIdx];

  const derivedCredit =
    (credit as { fico?: number } | null)?.fico ?? client?.fico ?? undefined;
  const derivedExperience = deriveExperienceTier(client?.experience);

  const inputs = useMemo<FixFlipInputs>(
    () => ({ ...i, creditScore: derivedCredit, experience: derivedExperience }),
    [i, derivedCredit, derivedExperience],
  );
  const result = useMemo(() => analyzeFixFlip(inputs), [inputs]);

  const set = <K extends keyof FixFlipInputs>(k: K, v: FixFlipInputs[K]) =>
    setI((p) => ({ ...p, [k]: v }));
  const setAddr = (k: "street" | "city" | "state" | "zip", v: string) =>
    setI((p) => ({ ...p, address: { ...p.address, [k]: v } }));
  const num = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;

  const stepValid = (s: Step): boolean => {
    if (s === "Property") return !!(inputs.address.street && inputs.address.city && inputs.address.state && inputs.address.zip);
    if (s === "Deal Numbers") return inputs.purchasePrice > 0 && inputs.arv > 0 && inputs.rehabCost >= 0;
    if (s === "Timeline & Cash") return inputs.constructionMonths > 0 && inputs.monthsToSell > 0;
    return true;
  };

  const fld = (label: string, value: number | string, on: (s: string) => void, ph?: string) => (
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
        client_id: client?.id ?? undefined,
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
  const selectedState = US_STATES.find((s) => s.code === inputs.address.state);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Icon name="x" size={18} color={t.ink} /></Pressable>
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>Deal Analyzer</Text>
        <Text style={{ marginLeft: "auto", fontSize: 12, color: t.ink3 }}>{stepIdx + 1}/{STEPS.length} · {step}</Text>
      </View>

      <KeyboardAware excludeTabBar>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {flash ? <Text style={{ fontSize: 12.5, color: flash.includes("Couldn") ? t.danger : t.brand, fontWeight: "600" }}>{flash}</Text> : null}

          {step === "Property" ? (
            <Card pad={14}>
              <SectionLabel>Property</SectionLabel>
              {fld("Street", inputs.address.street, (s) => setAddr("street", s))}
              {fld("City", inputs.address.city, (s) => setAddr("city", s))}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, textTransform: "uppercase", letterSpacing: 0.6 }}>State</Text>
                <Pressable
                  onPress={() => setStateOpen((o) => !o)}
                  style={{ marginTop: 4, borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: t.surface2, flexDirection: "row", alignItems: "center" }}
                >
                  <Text style={{ flex: 1, fontSize: 14, color: selectedState ? t.ink : t.ink4 }}>
                    {selectedState ? `${selectedState.code} — ${selectedState.name}` : "Select a state…"}
                  </Text>
                  <Icon name={stateOpen ? "chevU" : "chevD"} size={14} color={t.ink3} />
                </Pressable>
                {stateOpen ? (
                  <View style={{ marginTop: 4, borderWidth: 1, borderColor: t.line, borderRadius: 10, maxHeight: 220, overflow: "hidden" }}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {US_STATES.map((s) => (
                        <Pressable
                          key={s.code}
                          onPress={() => { setAddr("state", s.code); setStateOpen(false); }}
                          style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomColor: t.line, borderBottomWidth: 1, backgroundColor: s.code === inputs.address.state ? t.brandSoft : t.surface }}
                        >
                          <Text style={{ fontSize: 13.5, color: t.ink }}>{s.code} — {s.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              {fld("ZIP", inputs.address.zip, (s) => setAddr("zip", s))}
            </Card>
          ) : null}

          {step === "Deal Numbers" ? (
            <Card pad={14}>
              <SectionLabel>Deal numbers</SectionLabel>
              {fld("Purchase price / BRV", inputs.purchasePrice, (s) => set("purchasePrice", num(s)))}
              {fld("After repair value (ARV)", inputs.arv, (s) => set("arv", num(s)))}
              {fld("Rehab budget", inputs.rehabCost, (s) => set("rehabCost", num(s)))}
              {fld("Rehab contingency %", inputs.rehabContingencyPct * 100, (s) => set("rehabContingencyPct", num(s) / 100), "10")}
              {fld("Selling cost %", inputs.sellingCostPct * 100, (s) => set("sellingCostPct", num(s) / 100), "6")}
              {fld("Closing cost %", inputs.closingCostPct * 100, (s) => set("closingCostPct", num(s) / 100), "2")}
            </Card>
          ) : null}

          {step === "Timeline & Cash" ? (
            <Card pad={14}>
              <SectionLabel>Timeline &amp; cash</SectionLabel>
              {fld("Construction months", inputs.constructionMonths, (s) => set("constructionMonths", num(s)))}
              {fld("Months to sell", inputs.monthsToSell, (s) => set("monthsToSell", num(s)))}
              {fld("Monthly holding cost", inputs.monthlyHoldingCost, (s) => set("monthlyHoldingCost", num(s)))}
              {fld("Cash to work available", inputs.liquidity ?? 0, (s) => set("liquidity", num(s) || undefined))}
              <Text style={{ fontSize: 12, color: t.ink3 }}>Total hold: <Text style={{ color: t.ink, fontWeight: "700" }}>{result.holdMonths} mo</Text></Text>
            </Card>
          ) : null}

          {step === "Review" ? (
            <Card pad={14}>
              <SectionLabel>Borrower profile</SectionLabel>
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: t.ink3 }}>Credit score</Text>
                {derivedCredit != null
                  ? <Pill bg={t.brandSoft} color={t.brand}>{String(derivedCredit)}</Pill>
                  : <Pill bg={t.chip} color={t.ink3}>Not on file</Pill>}
                <Text style={{ fontSize: 12, color: t.ink3, marginLeft: 8 }}>Experience</Text>
                <Pill bg={t.chip} color={t.ink2}>{EXP_LABEL[derivedExperience]}</Pill>
              </View>
              <Text style={{ fontSize: 11.5, color: t.ink3, marginBottom: 12 }}>
                Credit &amp; experience come from your profile, not entered here.
              </Text>
              <SectionLabel>Recap</SectionLabel>
              <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 20 }}>
                {inputs.address.street}, {inputs.address.city} {inputs.address.state} {inputs.address.zip}{"\n"}
                Purchase {money(inputs.purchasePrice)} · ARV {money(inputs.arv)} · Rehab {money(inputs.rehabCost)}{"\n"}
                Hold {result.holdMonths} mo · Cash to work {money(inputs.liquidity ?? 0)}
              </Text>
            </Card>
          ) : null}

          {step === "Results" ? (
            result.validationErrors.length ? (
              <Card pad={16}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink }}>Missing information</Text>
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
                  {result.warnings.map((w) => <Text key={w} style={{ fontSize: 12.5, color: t.warn, marginTop: 6 }}>⚠ {w}</Text>)}
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
            )
          ) : null}

          {/* Wizard nav */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Pressable
              onPress={() => setStepIdx((x) => Math.max(0, x - 1))}
              disabled={stepIdx === 0}
              style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: t.line, opacity: stepIdx === 0 ? 0.4 : 1 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink2 }}>Back</Text>
            </Pressable>
            {step !== "Results" ? (
              <Pressable
                onPress={() => stepValid(step) && setStepIdx((x) => Math.min(STEPS.length - 1, x + 1))}
                disabled={!stepValid(step)}
                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: stepValid(step) ? t.brand : t.chip }}
              >
                <Text style={{ fontSize: 14, fontWeight: "800", color: stepValid(step) ? "#fff" : t.ink4 }}>
                  {step === "Review" ? "Analyze Deal" : "Next"}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
