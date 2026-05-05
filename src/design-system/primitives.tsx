import { type ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "./ThemeProvider";

export function Card({
  children,
  pad = 18,
  onPress,
  style,
}: {
  children: ReactNode;
  pad?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t, isDark } = useTheme();
  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.line,
          borderWidth: 1,
          borderRadius: 18,
          padding: pad,
          shadowColor: isDark ? "transparent" : "#0B1629",
          shadowOpacity: isDark ? 0 : 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
    >
      {children}
    </Comp>
  );
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, color: t.ink3, textTransform: "uppercase" }}>
        {children}
      </Text>
      {action && <View>{action}</View>}
    </View>
  );
}

export function Pill({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  const { t } = useTheme();
  return (
    <View style={{
      paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999,
      backgroundColor: bg ?? t.chip,
      alignSelf: "flex-start",
    }}>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: color ?? t.ink2 }}>
        {children}
      </Text>
    </View>
  );
}

export function Avatar({ label, color, size = 32 }: { label: string; color?: string; size?: number }) {
  const { t } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color ?? t.brand,
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.4 }}>{label}</Text>
    </View>
  );
}

export function Sparkline({
  data,
  color,
  width = 120,
  height = 36,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height * 0.85 - height * 0.075;
    return [x, y] as [number, number];
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.4} fill={color} />
    </Svg>
  );
}

export function StageBadge({ stage, label }: { stage: number; label?: string }) {
  const { t } = useTheme();
  const map = [
    { bg: t.chip, fg: t.ink2 },
    { bg: t.warnBg, fg: t.warn },
    { bg: t.petrolSoft, fg: t.petrol },
    { bg: t.brandSoft, fg: t.brand },
    { bg: t.warnBg, fg: t.warn },
    { bg: t.profitBg, fg: t.profit },
  ];
  const labels = ["Prequalified", "Collecting Docs", "Lender Connected", "Processing", "Closing", "Funded"];
  const { bg, fg } = map[stage] ?? map[0];
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: bg, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label ?? labels[stage]}
      </Text>
    </View>
  );
}

export function QButton({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { t } = useTheme();
  const bg = variant === "primary" ? t.brand : variant === "danger" ? t.danger : t.surface2;
  const fg = variant === "secondary" ? t.ink : "#fff";
  return (
    <Pressable onPress={onPress} style={{
      paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14,
      backgroundColor: bg, borderColor: t.line, borderWidth: variant === "secondary" ? 1 : 0,
      alignItems: "center",
    }}>
      <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
