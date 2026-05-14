// WizardSecretaryStep — Step 4 of the new-client wizard. Broker picks
// an AI cadence preset that governs how aggressively the nurturing AI
// follows up with this lead pre-loan. The preset becomes the
// `cadence_preset` posted to `/clients/{id}/deal-secretary/wizard-intent`
// right after the Client row is created.
//
// Phase 7 lead-automation: this is the broker's first lever for the
// Client AI tier. The presets translate to concrete cadence policies
// in the backend (gentle: 1/week, standard: 2-3/week, aggressive:
// daily-until-reply). See plan §7.4 for the backend wiring.

import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";

export type CadencePreset = "gentle" | "standard" | "aggressive";

interface Props {
  value: CadencePreset;
  onChange: (next: CadencePreset) => void;
}

interface PresetCard {
  value: CadencePreset;
  label: string;
  blurb: string;
  detail: string;
  iconTint: "neutral" | "brand" | "warn";
}

const PRESETS: PresetCard[] = [
  {
    value: "gentle",
    label: "Gentle",
    blurb: "Light touch — best for cold or referral leads",
    detail: "1 follow-up per week · weekday daytime · portal-first, SMS only when needed.",
    iconTint: "neutral",
  },
  {
    value: "standard",
    label: "Standard",
    blurb: "Default — keeps the conversation warm without burning the relationship",
    detail: "2–3 follow-ups per week · mixed SMS / email / portal · respects quiet hours.",
    iconTint: "brand",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    blurb: "Hot leads — keep them engaged until they reply",
    detail: "Daily attempts until a response · multi-channel · stops only on reply or opt-out.",
    iconTint: "warn",
  },
];

export function WizardSecretaryStep({ value, onChange }: Props) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Card pad={14}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.6, marginBottom: 6 }}>
          AI FOLLOW-UP CADENCE
        </Text>
        <Text style={{ fontSize: 12.5, color: t.ink2, lineHeight: 17 }}>
          Pick how often the AI checks in with this lead before they're handed
          to lending. You can change this on the client page anytime.
        </Text>
      </Card>
      <View style={{ gap: 8 }}>
        {PRESETS.map((p) => {
          const active = value === p.value;
          const tint =
            p.iconTint === "brand"
              ? { bg: t.brandSoft, fg: t.brand, ring: t.brand }
              : p.iconTint === "warn"
                ? { bg: t.warnBg, fg: t.warn, ring: t.warn }
                : { bg: t.chip, fg: t.ink2, ring: t.lineStrong };
          return (
            <Pressable
              key={p.value}
              onPress={() => onChange(p.value)}
              accessibilityLabel={`Select ${p.label} cadence`}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 14,
                backgroundColor: active ? tint.bg : t.surface,
                borderColor: active ? tint.ring : t.line,
                borderWidth: active ? 2 : 1,
                opacity: pressed ? 0.92 : 1,
                gap: 6,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    backgroundColor: tint.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="spark" size={14} color={tint.fg} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: t.ink, letterSpacing: -0.2 }}>
                  {p.label}
                </Text>
                {active ? <Icon name="check" size={14} stroke={3} color={tint.ring} /> : null}
              </View>
              <Text style={{ fontSize: 12, color: t.ink2, lineHeight: 17 }}>{p.blurb}</Text>
              <Text style={{ fontSize: 11.5, color: t.ink3, lineHeight: 16, marginTop: 2 }}>
                {p.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
