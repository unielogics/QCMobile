// Sticky top bar — the same on every tab. Branding (logo + 2-line wordmark)
// sits on the left, screen title underneath, account/theme/notification
// chips on the right.

import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";
import { QcLogo } from "@/design-system/QcLogo";
import { useMe } from "@/hooks/useApi";

function initialsOf(name: string | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function TopBar({ title }: { title: string }) {
  const { t, isDark, toggle } = useTheme();
  const router = useRouter();
  const { data: user } = useMe();

  return (
    <View style={{
      paddingTop: 6,
      paddingHorizontal: 18,
      paddingBottom: 12,
      backgroundColor: t.bg,
    }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        {/* Left: logo + 2-line wordmark */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <QcLogo size={36} />
          <View>
            <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink, letterSpacing: -0.2, lineHeight: 15 }}>
              Qualified
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color: t.ink, letterSpacing: -0.2, lineHeight: 15 }}>
              Commercial
            </Text>
          </View>
        </View>

        {/* Right: avatar / theme / bell */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            accessibilityLabel="Profile"
            style={{
              width: 36, height: 36, borderRadius: 999,
              backgroundColor: t.brandSoft,
              borderWidth: 1, borderColor: t.line,
              alignItems: "center", justifyContent: "center",
            }}>
            <Text style={{ color: t.brand, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 }}>
              {initialsOf(user?.name)}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggle}
            accessibilityLabel="Toggle theme"
            style={{
              width: 36, height: 36, borderRadius: 11,
              backgroundColor: t.surface,
              borderWidth: 1, borderColor: t.line,
              alignItems: "center", justifyContent: "center",
            }}>
            <Icon name={isDark ? "sun" : "moon"} size={16} color={t.ink2} />
          </Pressable>
          <Pressable
            accessibilityLabel="Notifications"
            style={{
              width: 36, height: 36, borderRadius: 11,
              backgroundColor: t.surface,
              borderWidth: 1, borderColor: t.line,
              alignItems: "center", justifyContent: "center",
            }}>
            <Icon name="bell" size={16} color={t.ink2} />
            <View style={{
              position: "absolute", top: 7, right: 8,
              width: 7, height: 7, borderRadius: 999,
              backgroundColor: t.danger,
              borderWidth: 1.5, borderColor: t.surface,
            }} />
          </Pressable>
        </View>
      </View>

      {/* Screen title — large, on its own row beneath the brand block */}
      <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: t.ink, marginTop: 10 }}>
        {title}
      </Text>
    </View>
  );
}
