import { Tabs } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon, type IconName } from "@/design-system/Icon";

function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <Icon name={name} size={20} stroke={focused ? 2.4 : 1.8} color={color} />;
}

export default function TabsLayout() {
  const { t } = useTheme();

  return (
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
          tabBarIcon: ({ color, focused }) => <TabIcon name="cal" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: "Simulate",
          tabBarIcon: ({ color, focused }) => <TabIcon name="sliders" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ color, focused }) => <TabIcon name="vault" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => <TabIcon name="chat" color={color} focused={focused} />,
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
  );
}
