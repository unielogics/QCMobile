import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, QButton, SectionLabel } from "@/design-system/primitives";
import { useStartCreditPull } from "@/hooks/useApi";

type Stage = "form" | "consent" | "pulling" | "done";

export default function CreditPull() {
  const { t } = useTheme();
  const router = useRouter();
  const start = useStartCreditPull();
  const [stage, setStage] = useState<Stage>("form");
  const [form, setForm] = useState({
    legal_first_name: "",
    legal_last_name: "",
    dob: "1985-01-01",
    street: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    last4_ssn: "",
  });

  const submit = async () => {
    setStage("pulling");
    try {
      await start.mutateAsync({ ...form, fcra_consent: true });
      setStage("done");
    } catch {
      setStage("consent");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: t.brand, fontWeight: "700" }}>✕ Cancel</Text>
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.ink }}>Soft Credit Pull</Text>
        <Text style={{ fontSize: 13, color: t.ink2 }}>
          We capture only what the bureaus require. No score impact. Valid for 90 days.
        </Text>

        {stage === "form" && (
          <Card pad={16}>
            <SectionLabel>Legal Name</SectionLabel>
            <Field label="First name" value={form.legal_first_name} onChangeText={(v) => setForm({ ...form, legal_first_name: v })} />
            <Field label="Last name" value={form.legal_last_name} onChangeText={(v) => setForm({ ...form, legal_last_name: v })} />
            <Field label="Date of birth" value={form.dob} onChangeText={(v) => setForm({ ...form, dob: v })} placeholder="YYYY-MM-DD" />

            <SectionLabel>Address Used for Credit</SectionLabel>
            <Field label="Street" value={form.street} onChangeText={(v) => setForm({ ...form, street: v })} />
            <Field label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
            <Field label="State (2-letter)" value={form.state} onChangeText={(v) => setForm({ ...form, state: v.toUpperCase() })} />
            <Field label="ZIP" value={form.zip} onChangeText={(v) => setForm({ ...form, zip: v })} />

            <SectionLabel>Contact</SectionLabel>
            <Field label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
            <Field label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />

            <SectionLabel>Identity</SectionLabel>
            <Field label="Last 4 of SSN" value={form.last4_ssn} onChangeText={(v) => setForm({ ...form, last4_ssn: v })} secureTextEntry />

            <View style={{ marginTop: 12 }}>
              <QButton label="Continue to Consent" onPress={() => setStage("consent")} />
            </View>
          </Card>
        )}

        {stage === "consent" && (
          <Card pad={16}>
            <SectionLabel>FCRA Consent</SectionLabel>
            <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 20 }}>
              I, {form.legal_first_name} {form.legal_last_name}, authorize Qualified Commercial to obtain my consumer credit report from Experian, TransUnion, and Equifax for the purpose of evaluating loan products. I understand this is a soft pull and will not affect my credit score.
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              <QButton label="I Authorize · Run Soft Pull" onPress={submit} />
              <QButton label="Back" variant="secondary" onPress={() => setStage("form")} />
            </View>
          </Card>
        )}

        {stage === "pulling" && (
          <Card pad={24}>
            <Text style={{ color: t.ink, fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Pulling… Experian → TransUnion → Equifax
            </Text>
          </Card>
        )}

        {stage === "done" && (
          <Card pad={24}>
            <Text style={{ color: t.profit, fontSize: 14, fontWeight: "700", textAlign: "center" }}>Done</Text>
            <Text style={{ color: t.ink, fontSize: 36, fontWeight: "800", textAlign: "center", marginTop: 8 }}>
              {start.data?.fico ?? "—"}
            </Text>
            <Text style={{ color: t.ink3, fontSize: 12, textAlign: "center", marginTop: 4 }}>
              Valid through {start.data?.expires_at ? new Date(start.data.expires_at).toLocaleDateString() : "—"}
            </Text>
            <View style={{ marginTop: 16 }}>
              <QButton label="Done" onPress={() => router.back()} />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...rest }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const { t } = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" }}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={t.ink4}
        style={{
          backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1,
          borderRadius: 10, padding: 12, fontSize: 14, color: t.ink,
        }}
      />
    </View>
  );
}
