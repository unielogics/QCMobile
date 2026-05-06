// Mobile Simulator (tab) — mirrors the loan-detail Simulation pane but stands
// alone. Lets a borrower model what an ARV-driven loan looks like for any
// product, gated by their credit + experience tier.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { Slider } from "@/design-system/Slider";
import { QC_FMT } from "@/design-system/tokens";
import { TopBar } from "@/components/TopBar";
import { useFredSeries, useLoans, useMyCredit } from "@/hooks/useApi";
import {
  computeEligibility,
  computeSimulator,
  ltvLabel,
  type EligibilityBanner,
  type SimulatorInputs,
} from "@/lib/eligibility";

const PRODUCTS: { id: SimulatorInputs["productKey"]; label: string; sub: string }[] = [
  { id: "dscr", label: "DSCR Rental",   sub: "30 yr" },
  { id: "ff",   label: "Fix & Flip",    sub: "12 mo" },
  { id: "gu",   label: "Ground Up",     sub: "18 mo" },
  { id: "br",   label: "Bridge",        sub: "24 mo" },
];

// Mirrors qcdesktop's LOAN_TYPE_TO_SERIES — keep in sync. Maps the
// client-facing product key to the FRED benchmark used to price it.
const PRODUCT_TO_SERIES: Record<SimulatorInputs["productKey"], string> = {
  dscr: "DGS10",
  ff:   "DPRIME",
  gu:   "DPRIME",
  br:   "SOFR",
};

export default function Simulator() {
  const { t, isDark } = useTheme();
  const router = useRouter();
  const { data: credit } = useMyCredit();
  const { data: loans = [] } = useLoans();
  const { data: fred } = useFredSeries();

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

  const [productKey, setProductKey] = useState<SimulatorInputs["productKey"]>("dscr");
  const [arvText, setArvText] = useState("500000");
  const [brvText, setBrvText] = useState("400000");
  const [points, setPoints] = useState(1);
  const initialLtv = Math.min(eligibility.maxLTV * 100 || 65, 65);
  const [ltvPct, setLtvPct] = useState(initialLtv);

  const arvNum = Number(arvText.replace(/[^0-9.]/g, "")) || 0;
  const brvNum = Number(brvText.replace(/[^0-9.]/g, "")) || 0;
  const isBlocked = eligibility.tier === "blocked";
  const reno = productKey === "ff" || productKey === "gu";
  const propertyLabel = reno ? "ARV (After Repair Value)" : "Market Value";

  // Pull today's rate from FRED for the selected product. Falls through to
  // the hardcoded table inside computeSimulator when FRED isn't available.
  const liveRate = fred?.find((s) => s.series_id === PRODUCT_TO_SERIES[productKey]);
  const baseRatePct = liveRate?.estimated_rate ?? undefined;

  const sim = useMemo(() => {
    if (isBlocked || arvNum <= 0) return null;
    return computeSimulator({
      arv: arvNum,
      ltv: ltvPct / 100,
      discountPoints: points,
      productKey,
      baseRatePct,
    });
  }, [isBlocked, arvNum, ltvPct, points, productKey, baseRatePct]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Simulator" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Eligibility banner */}
        {eligibility.banner ? (
          <View style={{ marginBottom: 12 }}>
            <EligibilityBannerCard
              banner={eligibility.banner}
              onCta={(target) => {
                if (target === "credit-pull") router.push("/credit-pull");
                if (target === "vault") router.push("/(tabs)/vault");
                if (target === "new-loan") router.push("/(tabs)");
              }}
            />
          </View>
        ) : null}

        {/* Product selector */}
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: t.chip, borderRadius: 12, padding: 3, marginBottom: 14 }}>
          {PRODUCTS.map((p) => {
            const active = productKey === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setProductKey(p.id)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: active ? t.surface : "transparent", alignItems: "center" }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? t.ink : t.ink3 }}>{p.label}</Text>
                <Text style={{ fontSize: 9.5, fontWeight: "600", color: active ? t.ink3 : t.ink4, marginTop: 2 }}>{p.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Hero rate display */}
        <View style={{ borderRadius: 18, padding: 20, backgroundColor: isDark ? t.surface : t.brand, marginBottom: 14 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.4, opacity: 0.7, color: isDark ? t.ink3 : "#fff", textTransform: "uppercase" }}>Your Rate</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <Text style={{ fontSize: 44, fontWeight: "700", letterSpacing: -1.5, color: isDark ? t.ink : "#fff", lineHeight: 48 }}>
              {sim ? (sim.rate * 100).toFixed(3) : "—"}
              <Text style={{ fontSize: 22, opacity: 0.8 }}>%</Text>
            </Text>
            <Text style={{ fontSize: 11, opacity: 0.7, fontWeight: "600", color: isDark ? t.ink2 : "#fff" }}>
              {points > 0 ? `−${(points * 25).toFixed(0)} bps` : "no discount"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? t.line : "rgba(255,255,255,0.15)" }}>
            <HeroStat label="Loan amount" value={sim ? QC_FMT.short(sim.loanAmount) : "—"} />
            <HeroStat
              label="Monthly P&I"
              value={sim ? QC_FMT.usd(sim.monthlyPI, 0) : "—"}
            />
            {productKey === "dscr" ? (
              <HeroStat
                label="DSCR"
                value={sim?.dscr != null ? sim.dscr.toFixed(2) : "—"}
                accent={sim?.dscr != null ? (sim.dscr > 1.25 ? t.profit : sim.dscr > 1 ? t.warn : t.danger) : undefined}
              />
            ) : null}
          </View>
        </View>

        {/* Property value(s) — reno shows BRV + ARV, stabilized shows Market Value. */}
        <Card pad={14} style={{ marginBottom: 12 }}>
          {reno ? (
            <>
              <ValueInput
                label="BRV (Before Repair Value)"
                hint="As-is purchase value"
                value={brvText}
                onChange={setBrvText}
                num={brvNum}
                placeholder="400000"
              />
              <View style={{ height: 12 }} />
              <ValueInput
                label={propertyLabel}
                hint="Loan sized off ARV × LTV"
                value={arvText}
                onChange={setArvText}
                num={arvNum}
                placeholder="500000"
              />
            </>
          ) : (
            <ValueInput
              label={propertyLabel}
              hint="Loan amount = Market Value × LTV"
              value={arvText}
              onChange={setArvText}
              num={arvNum}
              placeholder="500000"
            />
          )}
          {liveRate?.estimated_rate != null ? (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.line }}>
              <Text style={{ fontSize: 10.5, color: t.ink3, fontWeight: "600" }}>
                Today's base rate · {liveRate.label} +{liveRate.spread_bps} bps
              </Text>
              <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700", marginTop: 2, fontVariant: ["tabular-nums"] }}>
                {liveRate.estimated_rate.toFixed(3)}%
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Discount points slider */}
        <Card pad={14} style={{ marginBottom: 12 }}>
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

        {/* LTV slider */}
        <Card pad={14} style={{ marginBottom: 12 }}>
          <SliderHeader
            label={reno ? "Loan-to-ARV" : "Loan-to-value (LTV)"}
            value={`${ltvPct}%`}
            hint={ltvLabel(ltvPct / 100)}
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
            <Text style={{ fontSize: 11, color: t.ink3, marginTop: 6 }}>
              70% and 75% locked at this tier.
            </Text>
          ) : null}
        </Card>

        {/* HUD-1 breakdown */}
        {sim ? (
          <Card pad={0} style={{ overflow: "hidden", marginBottom: 12 }}>
            <View style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: t.surface2, borderBottomWidth: 1, borderBottomColor: t.line }}>
              <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, color: t.ink3, textTransform: "uppercase" }}>HUD-1 estimated closing</Text>
              <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>Estimate · subject to verification</Text>
            </View>
            {[
              { l: "801 · Origination Fee", sub: "0.75% of loan amount", v: sim.origination },
              { l: "802 · Discount Points", sub: `${points.toFixed(2)} pts`, v: sim.pointsCost, hl: true },
              { l: "804 · Appraisal",       sub: "Standard residential", v: sim.appraisal },
              { l: "811/812 · Processing + UW", sub: "",                  v: sim.fixedFees },
              { l: "1108 · Title Insurance", sub: "Lender + owner",       v: sim.titleIns },
              { l: "1201 · Recording Fees",  sub: "",                     v: sim.recording },
            ].map((row, i, arr) => (
              <View
                key={row.l}
                style={{
                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                  paddingVertical: 11, paddingHorizontal: 16,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: t.line,
                  backgroundColor: row.hl ? t.brandSoft : "transparent",
                }}
              >
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: row.hl ? "700" : "500", color: t.ink }}>{row.l}</Text>
                  {row.sub ? <Text style={{ fontSize: 10.5, color: t.ink3, marginTop: 1 }}>{row.sub}</Text> : null}
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>{QC_FMT.usd(row.v, 0)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, backgroundColor: t.surface2, borderTopWidth: 1, borderTopColor: t.lineStrong }}>
              <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.4, color: t.ink, textTransform: "uppercase" }}>Total to close</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: t.ink }}>{QC_FMT.usd(sim.totalToClose, 0)}</Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ValueInput({
  label,
  hint,
  value,
  onChange,
  num,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  num: number;
  placeholder: string;
}) {
  const { t } = useTheme();
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.lineStrong, borderRadius: 11, backgroundColor: t.surface2, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink3, marginRight: 4 }}>$</Text>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={t.ink4}
          style={{ flex: 1, paddingVertical: 12, fontSize: 18, fontWeight: "700", color: t.ink }}
        />
        <Text style={{ fontSize: 12, color: t.ink3, marginLeft: 8 }}>{num >= 1000 ? QC_FMT.short(num) : ""}</Text>
      </View>
      <Text style={{ fontSize: 11, color: t.ink3, marginTop: 6 }}>{hint}</Text>
    </View>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const { isDark, t } = useTheme();
  const fg = accent ?? (isDark ? t.ink : "#fff");
  const subFg = isDark ? t.ink3 : "rgba(255,255,255,0.7)";
  return (
    <View>
      <Text style={{ fontSize: 9.5, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", color: subFg }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: fg, marginTop: 2 }}>{value}</Text>
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
          <Text style={{ fontSize: 12, color: t.ink2, marginTop: 4, lineHeight: 17 }}>{banner.body}</Text>
          {banner.ctaLabel && banner.ctaTarget ? (
            <Pressable
              onPress={() => onCta(banner.ctaTarget!)}
              style={({ pressed }) => ({
                marginTop: 10, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9,
                backgroundColor: palette.fg, alignSelf: "flex-start",
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
