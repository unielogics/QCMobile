import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";

export default function TabsLayout() {
  const { t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.ink3,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌂</Text> }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌚</Text> }} />
      <Tabs.Screen name="simulator" options={{ title: "Simulate", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⊕</Text> }} />
      <Tabs.Screen name="vault" options={{ title: "Vault", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌬</Text> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text> }} />
    </Tabs>
  );
}
