// HUD line viewer. Read-only mobile list for now; create / edit
// flows would mount via BottomSheet in a follow-up.
// Phase 3 — gated by BACKEND_HAS_HUD.

import { Text, View } from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, SectionLabel } from "@/design-system/primitives";
import { useHudLines } from "@/hooks/useApi";
import { QC_FMT } from "@/design-system/tokens";

export function HudTab({ loanId }: { loanId: string }) {
  const { t } = useTheme();
  const { data = [], isLoading } = useHudLines(loanId);
  if (isLoading) {
    return (
      <Card pad={18}>
        <Text style={{ color: t.ink3, fontSize: 13 }}>Loading HUD lines…</Text>
      </Card>
    );
  }
  if (data.length === 0) {
    return (
      <Card pad={18}>
        <SectionLabel>HUD lines</SectionLabel>
        <Text style={{ color: t.ink3, fontSize: 13 }}>No HUD lines on this loan yet.</Text>
      </Card>
    );
  }
  const total = data.reduce((s, l) => s + Number(l.amount || 0), 0);
  return (
    <Card pad={14}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 }}>
        <SectionLabel>HUD lines</SectionLabel>
        <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>{QC_FMT.short(total)}</Text>
      </View>
      {data.map((line, i) => (
        <View
          key={line.id}
          style={{
            paddingVertical: 10,
            borderBottomColor: t.line,
            borderBottomWidth: i < data.length - 1 ? 1 : 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: t.ink3, width: 38 }}>{line.line_number}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink }} numberOfLines={1}>
              {line.description}
            </Text>
            {line.payee ? (
              <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }} numberOfLines={1}>{line.payee}</Text>
            ) : null}
          </View>
          <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink }}>{QC_FMT.short(Number(line.amount || 0))}</Text>
        </View>
      ))}
    </Card>
  );
}
