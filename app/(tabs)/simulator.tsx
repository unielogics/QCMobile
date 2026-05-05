import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, QButton, SectionLabel } from "@/design-system/primitives";
import { QC_FMT } from "@/design-system/tokens";
import { useLoans, useRecalc } from "@/hooks/useApi";

export default function Simulator() {
  const { t } = useTheme();
  const { data: loans = [] } = useLoans();
  const recalc = useRecalc();
  const [activeLoan, setActiveLoan] = useState<string | null>(null);
  const [points, setPoints] = useState(0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink }}>Simulate</Text>

        <Card pad={16}>
          <SectionLabel>Pick a loan</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {loans.map((l) => (
              <View key={l.id}>
                <QButton
                  label={`${l.deal_id} · ${l.type.replace("_", " ")}`}
                  variant={activeLoan === l.id ? "primary" : "secondary"}
                  onPress={() => setActiveLoan(l.id)}
                />
              </View>
            ))}
          </View>
        </Card>

        {activeLoan && (
          <Card pad={16}>
            <SectionLabel>Discount points (buy down)</SectionLabel>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((p) => (
                <View key={p} style={{ flex: 1, padding: 4 }}>
                  <QButton
                    label={p.toFixed(2)}
                    variant={points === p ? "primary" : "secondary"}
                    onPress={() => setPoints(p)}
                  />
                </View>
              ))}
            </View>
            <View style={{ marginTop: 8 }}>
              <QButton
                label={recalc.isPending ? "Recalculating…" : "Recalculate"}
                onPress={() => recalc.mutate({ loanId: activeLoan, discount_points: points })}
              />
            </View>

            {recalc.data && (
              <View style={{ marginTop: 16, gap: 12 }}>
                <Stat label="Final rate" value={`${(recalc.data.final_rate * 100).toFixed(3)}%`} />
                <Stat label="Monthly P&I" value={QC_FMT.usd(recalc.data.monthly_pi)} />
                {recalc.data.dscr != null && <Stat label="DSCR" value={recalc.data.dscr.toFixed(2)} />}
                <Stat label="Cash to close (pricing)" value={QC_FMT.usd(recalc.data.cash_to_close_pricing)} />
                <Stat label="HUD-1 total" value={QC_FMT.usd(recalc.data.hud_total)} />
              </View>
            )}

            {recalc.data?.warnings && recalc.data.warnings.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                {recalc.data.warnings.map((w) => (
                  <View key={w.code} style={{ padding: 10, borderRadius: 8, backgroundColor: w.severity === "block" ? t.dangerBg : t.warnBg }}>
                    <Text style={{ color: w.severity === "block" ? t.danger : t.warn, fontSize: 12, fontWeight: "700" }}>
                      {w.message}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.line }}>
      <Text style={{ color: t.ink3, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: t.ink, fontWeight: "800", fontSize: 16 }}>{value}</Text>
    </View>
  );
}
