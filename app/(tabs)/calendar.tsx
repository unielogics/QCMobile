import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";

export default function Calendar() {
  const { t } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginBottom: 12 }}>Activity</Text>
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>
            Agenda + month grid coming next pass. The desktop's Calendar API endpoint is wired —
            this screen will consume it directly via useCalendar() once styling is finished.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
