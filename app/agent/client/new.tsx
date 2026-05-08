import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { useCreateClient } from "@/hooks/useApi";

export default function AgentAddLeadRoute() {
  const { t } = useTheme();
  const router = useRouter();
  const create = useCreateClient();
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    referral_source: "",
    client_type: null as "buyer" | "seller" | null,
  });

  const canSubmit = draft.name.trim().length > 0 && !create.isPending;

  const onSubmit = async () => {
    try {
      const created = await create.mutateAsync({
        name: draft.name.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        city: draft.city.trim() || undefined,
        referral_source: draft.referral_source.trim() || undefined,
        stage: "lead",
        client_type: draft.client_type ?? undefined,
      });
      router.replace(`/agent/client/${created.id}` as Href);
    } catch (e) {
      Alert.alert("Couldn't create lead", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="x" size={18} color={t.ink} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink, flex: 1 }}>Add Lead</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          <Card pad={16}>
            <Field t={t} label="Name" required>
              <Input t={t} value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Jane Doe" />
            </Field>
            <Field t={t} label="Email">
              <Input t={t} value={draft.email} onChangeText={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <Field t={t} label="Phone">
              <Input t={t} value={draft.phone} onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))} placeholder="(555) 123-4567" keyboardType="phone-pad" />
            </Field>
            <Field t={t} label="City">
              <Input t={t} value={draft.city} onChangeText={(v) => setDraft((d) => ({ ...d, city: v }))} placeholder="Miami" />
            </Field>
            <Field t={t} label="Referral source">
              <Input t={t} value={draft.referral_source} onChangeText={(v) => setDraft((d) => ({ ...d, referral_source: v }))} placeholder="Past client, Zillow, etc." />
            </Field>

            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.6, marginBottom: 6 }}>SIDE</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["buyer", "seller"] as const).map((side) => {
                  const active = draft.client_type === side;
                  return (
                    <Pressable
                      key={side}
                      onPress={() => setDraft((d) => ({ ...d, client_type: active ? null : side }))}
                      style={({ pressed }) => ({
                        flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center",
                        backgroundColor: active ? t.brand : t.surface2,
                        borderColor: active ? t.brand : t.line, borderWidth: 1,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : t.ink }}>
                        {side === "buyer" ? "Buyer" : "Seller"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: t.brand, paddingVertical: 13, borderRadius: 10, alignItems: "center",
              opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {create.isPending ? "Adding…" : "Add lead"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  t, label, required, children,
}: {
  t: ReturnType<typeof useTheme>["t"];
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.6, marginBottom: 6 }}>
        {label.toUpperCase()}{required ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}

function Input({
  t, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  t: ReturnType<typeof useTheme>["t"];
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.ink4}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "sentences"}
      style={{
        backgroundColor: t.surface2, color: t.ink, fontSize: 14,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
        borderColor: t.line, borderWidth: 1,
      }}
    />
  );
}
