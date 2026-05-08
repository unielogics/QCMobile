import { Tabs } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon, type IconName } from "@/design-system/Icon";
import { FundingAccessGate } from "@/components/FundingAccessGate";
import { useExperienceMode } from "@/hooks/useExperienceMode";

function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <Icon name={name} size={20} stroke={focused ? 2.4 : 1.8} color={color} />;
}

export default function TabsLayout() {
  const { t } = useTheme();
  const mode = useExperienceMode();
  const guided = mode === "guided";

  return (
    <FundingAccessGate>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.ink4,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.2, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          href: guided ? null : "/(tabs)/calendar",
          tabBarIcon: ({ color, focused }) => <TabIcon name="cal" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: guided ? "My Deal" : "Simulate",
          tabBarIcon: ({ color, focused }) => <TabIcon name="sliders" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: guided ? "Documents" : "Vault",
          tabBarIcon: ({ color, focused }) => <TabIcon name="vault" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <TabIcon name="user" color={color} focused={focused} />,
        }}
      />
    </Tabs>
    </FundingAccessGate>
  );
}
