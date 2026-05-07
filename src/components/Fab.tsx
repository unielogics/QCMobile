import { Pressable, View } from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";

export function Fab({ onPress, icon = "plus" }: { onPress?: () => void; icon?: string }) {
  const { t, isDark } = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", right: 16, bottom: 44, zIndex: 40 }}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Quick action"
        style={({ pressed }) => ({
          width: 56, height: 56, borderRadius: 18,
          backgroundColor: t.petrol,
          alignItems: "center", justifyContent: "center",
          shadowColor: t.petrol,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon name={icon} size={26} stroke={2.5} color={isDark ? "#06070B" : "#fff"} />
      </Pressable>
    </View>
  );
}
