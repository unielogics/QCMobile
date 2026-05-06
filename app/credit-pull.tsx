import { useState } from "react";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, QButton, SectionLabel } from "@/design-system/primitives";

type Stage = "form" | "consent" | "pulling" | "done";

// Mock FICO until backend credit-pull is wired end-to-end.
const MOCK_FICO = 707;

export default function CreditPull() {
  const { t } = useTheme();
  const router = useRouter();
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
    // Simulate the bureau roundtrip — keeps UX realistic until the real
    // /credit/pull mutation lands. Backend wiring TODO.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    setStage("done");
  };

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: t.brand, fontWeight: "700" }}>✕ Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: "800", color: t.ink }}>Soft Credit Pull</Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>
            We capture only what the bureaus require. No score impact. Valid for 90 days.
          </Text>

          {stage === "form" && (
            <Card pad={16}>
              <SectionLabel>Legal Name</SectionLabel>
              <Field label="First name" value={form.legal_first_name} onChangeText={(v) => setForm({ ...form, legal_first_name: v })} autoCapitalize="words" />
              <Field label="Last name" value={form.legal_last_name} onChangeText={(v) => setForm({ ...form, legal_last_name: v })} autoCapitalize="words" />
              <Field label="Date of birth" value={form.dob} onChangeText={(v) => setForm({ ...form, dob: v })} placeholder="YYYY-MM-DD" autoCapitalize="none" />

              <SectionLabel>Address Used for Credit</SectionLabel>
              <Field label="Street" value={form.street} onChangeText={(v) => setForm({ ...form, street: v })} autoCapitalize="words" />
              <Field label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} autoCapitalize="words" />
              <Field label="State (2-letter)" value={form.state} onChangeText={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} autoCapitalize="characters" />
              <Field label="ZIP" value={form.zip} onChangeText={(v) => setForm({ ...form, zip: v })} keyboardType="number-pad" />

              <SectionLabel>Contact</SectionLabel>
              <Field label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              <Field label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />

              <SectionLabel>Identity</SectionLabel>
              <Field label="Last 4 of SSN" value={form.last4_ssn} onChangeText={(v) => setForm({ ...form, last4_ssn: v.replace(/\D/g, "").slice(0, 4) })} keyboardType="number-pad" secureTextEntry />

              <View style={{ marginTop: 12 }}>
                <QButton label="Continue to Consent" onPress={() => setStage("consent")} />
              </View>
            </Card>
          )}

          {stage === "consent" && (
            <Card pad={16}>
              <SectionLabel>FCRA Consent</SectionLabel>
              <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 20 }}>
                I, {form.legal_first_name} {form.legal_last_name}, authorize Qualified Commercial to obtain
                my consumer credit report from Experian, TransUnion, and Equifax for the purpose of evaluating
                loan products. I understand this is a soft pull and will not affect my credit score.
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
              <Text style={{ color: t.profit, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
                Verified
              </Text>
              <Text style={{ color: t.ink, fontSize: 36, fontWeight: "800", textAlign: "center", marginTop: 8 }}>
                {MOCK_FICO}
              </Text>
              <Text style={{ color: t.ink3, fontSize: 12, textAlign: "center", marginTop: 4 }}>
                Valid through {expiresAt.toLocaleDateString()}
              </Text>
              <Text style={{ color: t.ink4, fontSize: 11, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
                (placeholder score until /credit/pull is wired end-to-end)
              </Text>
              <View style={{ marginTop: 16 }}>
                <QButton label="Done" onPress={() => router.back()} />
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
