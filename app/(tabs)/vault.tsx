import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";

export default function Vault() {
  const { t } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink, marginBottom: 12 }}>Experience Vault</Text>
        <Card pad={16}>
          <Text style={{ color: t.ink3, fontSize: 13 }}>
            Subject Property + REO Schedule tabs with AI verification badges. Coming next pass —
            the doc upload + presigned-S3 endpoint is wired in qcbackend already.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
