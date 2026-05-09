import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { useCreateClient } from "@/hooks/useApi";

// Mobile mirror of QCDashboard's AgentLeadModal — 4-step lead capture
// for agents (BROKER role). Always creates a Client at stage="lead";
// never creates a Loan. The funding-team handoff happens later via
// "Ready for Prequalification" on /agent/client/[id] (or via the AI
// Secretary card in AIChatSheet).
//
// Steps mirror the desktop:
//   1. Lead     — side, name/email/phone, lead source/temperature,
//                 financing-support-needed, contact permission
//   2. Property — address (optional for buyers still searching)
//   3. Numbers  — buyer: budget + deposit + liquidity + timeline
//                 seller: listing price + dates
//   4. Handoff  — cadence preset + handoff note + Save / Save+Invite

type Side = "buyer" | "seller";

interface LeadDraft {
  // Step 1
  side: Side;
  name: string;
  email: string;
  phone: string;
  leadSource: string;
  leadTemperature: "hot" | "warm" | "nurture";
  financingSupportNeeded: "yes" | "maybe" | "no" | "unknown";
  contactPermission: "send_invite_now" | "save_lead_only" | "agent_will_introduce_first";
  relationshipContext: string;

  // Step 2 — buyer can be still-searching (no address)
  propertyStatus: "selected" | "still_searching" | "multiple";
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;

  // Step 3
  priceMode: "exact" | "range";
  purchasePrice: string;
  priceRangeLow: string;
  priceRangeHigh: string;
  depositAvailable: string;
  liquidityConfidence: "confirmed" | "verbal" | "unknown";
  timeline: string;
  targetCloseDate: string;
  listingPrice: string;
  targetListDate: string;

  // Step 4
  cadencePreset: "gentle" | "standard" | "aggressive";
  handoffNote: string;
}

const INITIAL: LeadDraft = {
  side: "buyer",
  name: "",
  email: "",
  phone: "",
  leadSource: "manual_entry",
  leadTemperature: "warm",
  financingSupportNeeded: "unknown",
  contactPermission: "save_lead_only",
  relationshipContext: "new_lead",

  propertyStatus: "still_searching",
  propertyAddress: "",
  propertyCity: "",
  propertyState: "",

  priceMode: "exact",
  purchasePrice: "",
  priceRangeLow: "",
  priceRangeHigh: "",
  depositAvailable: "",
  liquidityConfidence: "unknown",
  timeline: "60_plus",
  targetCloseDate: "",
  listingPrice: "",
  targetListDate: "",

  cadencePreset: "standard",
  handoffNote: "",
};

const STEPS = [
  { id: "lead", label: "Lead" },
  { id: "property", label: "Property" },
  { id: "numbers", label: "Numbers" },
  { id: "handoff", label: "Handoff" },
] as const;

const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "manual_entry", label: "Manual entry" },
  { value: "open_house", label: "Open house" },
  { value: "referral", label: "Referral" },
  { value: "listing_inquiry", label: "Listing inquiry" },
  { value: "buyer_consultation", label: "Buyer consultation" },
  { value: "existing_database", label: "Existing database" },
  { value: "other", label: "Other" },
];

const TIMELINE_OPTIONS: { value: string; label: string }[] = [
  { value: "asap", label: "ASAP" },
  { value: "0_30", label: "0-30 days" },
  { value: "30_60", label: "30-60 days" },
  { value: "60_plus", label: "60+ days" },
];

export default function AgentAddLeadRoute() {
  const { t } = useTheme();
  const router = useRouter();
  const create = useCreateClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LeadDraft>(INITIAL);

  const update = <K extends keyof LeadDraft>(k: K, v: LeadDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const canAdvance = (): boolean => {
    if (step === 0) {
      // Email mandatory, phone optional. Mirrors desktop AgentLeadModal.
      return draft.name.trim().length > 0 && draft.email.trim().includes("@");
    }
    if (step === 1) {
      // Sellers need an address; buyers can be "still searching".
      if (draft.side === "seller") return draft.propertyAddress.trim().length > 0;
      return true;
    }
    return true;
  };

  const submit = async (intent: "save" | "save_and_invite") => {
    try {
      const lead_intake = buildLeadIntake(draft);
      const finalContactPermission =
        intent === "save_and_invite" ? "send_invite_now" : draft.contactPermission;
      const created = await create.mutateAsync({
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
        stage: "lead",
        client_type: draft.side,
        lead_intake,
        lead_source: draft.leadSource,
        lead_temperature: draft.leadTemperature,
        financing_support_needed: draft.financingSupportNeeded,
        contact_permission: finalContactPermission,
        relationship_context: draft.relationshipContext,
        source_channel: "agent_mobile",
      });
      router.replace(`/agent/client/${created.id}` as Href);
    } catch (e) {
      Alert.alert("Couldn't save lead", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
        <Pressable onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))} hitSlop={8}>
          <Icon name={step === 0 ? "x" : "x"} size={18} color={t.ink} />
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "800", color: t.ink, flex: 1 }}>
          New Lead · {draft.side === "seller" ? "Listing" : "Purchase"}
        </Text>
        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>
          Step {step + 1}/{STEPS.length}
        </Text>
      </View>

      {/* Stepper */}
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
        {STEPS.map((s, i) => (
          <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? t.brand : t.line }} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {step === 0 && <LeadStepView t={t} draft={draft} update={update} />}
          {step === 1 && <PropertyStepView t={t} draft={draft} update={update} />}
          {step === 2 && <NumbersStepView t={t} draft={draft} update={update} />}
          {step === 3 && <HandoffStepView t={t} draft={draft} update={update} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer — Continue or Save / Save+Invite */}
      <View style={{ padding: 12, paddingBottom: 22, borderTopColor: t.line, borderTopWidth: 1, backgroundColor: t.surface }}>
        {step < STEPS.length - 1 ? (
          <Pressable
            onPress={() => canAdvance() && setStep((s) => s + 1)}
            disabled={!canAdvance()}
            style={({ pressed }) => ({
              backgroundColor: t.brand, paddingVertical: 13, borderRadius: 10, alignItems: "center",
              opacity: !canAdvance() ? 0.45 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Continue →</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => void submit("save")}
              disabled={create.isPending}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center",
                backgroundColor: t.surface2, borderColor: t.line, borderWidth: 1,
                opacity: create.isPending ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: t.ink, fontWeight: "800", fontSize: 13 }}>Save Lead</Text>
            </Pressable>
            <Pressable
              onPress={() => void submit("save_and_invite")}
              disabled={create.isPending}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center",
                backgroundColor: t.brand,
                opacity: create.isPending ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                {create.isPending ? "Saving…" : "Save + Send Invite"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Step views ──────────────────────────────────────────────────────────

interface StepProps {
  t: ReturnType<typeof useTheme>["t"];
  draft: LeadDraft;
  update: <K extends keyof LeadDraft>(k: K, v: LeadDraft[K]) => void;
}

function LeadStepView({ t, draft, update }: StepProps) {
  return (
    <Card pad={14}>
      <SectionLabel t={t}>Listing or Purchase?</SectionLabel>
      <SegmentedRow
        t={t}
        options={[
          { value: "buyer", label: "Purchase (Buyer)" },
          { value: "seller", label: "Listing (Seller)" },
        ]}
        value={draft.side}
        onChange={(v) => update("side", v as Side)}
      />

      <View style={{ height: 12 }} />

      <Field t={t} label="Name" required>
        <Input t={t} value={draft.name} onChangeText={(v) => update("name", v)} placeholder="Marcus Holloway" />
      </Field>
      <Field t={t} label="Email" required>
        <Input
          t={t}
          value={draft.email}
          onChangeText={(v) => update("email", v)}
          placeholder="marcus@holloway.cap"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>
      <Field t={t} label="Phone">
        <Input
          t={t}
          value={draft.phone}
          onChangeText={(v) => update("phone", v)}
          placeholder="(917) 555-0148"
          keyboardType="phone-pad"
        />
      </Field>

      <Field t={t} label="Lead source">
        <PillRow
          t={t}
          value={draft.leadSource}
          onChange={(v) => update("leadSource", v)}
          options={LEAD_SOURCES}
        />
      </Field>

      <Field t={t} label="Lead temperature">
        <SegmentedRow
          t={t}
          options={[
            { value: "hot", label: "Hot" },
            { value: "warm", label: "Warm" },
            { value: "nurture", label: "Nurture" },
          ]}
          value={draft.leadTemperature}
          onChange={(v) => update("leadTemperature", v as LeadDraft["leadTemperature"])}
        />
      </Field>

      <Field t={t} label="Financing support needed?">
        <PillRow
          t={t}
          value={draft.financingSupportNeeded}
          onChange={(v) => update("financingSupportNeeded", v as LeadDraft["financingSupportNeeded"])}
          options={[
            { value: "yes", label: "Yes" },
            { value: "maybe", label: "Maybe" },
            { value: "no", label: "No / cash" },
            { value: "unknown", label: "Unknown" },
          ]}
        />
      </Field>

      <Field t={t} label="Permission to contact">
        <PillRow
          t={t}
          value={draft.contactPermission}
          onChange={(v) => update("contactPermission", v as LeadDraft["contactPermission"])}
          options={[
            { value: "send_invite_now", label: "Invite now" },
            { value: "save_lead_only", label: "Save only" },
            { value: "agent_will_introduce_first", label: "I'll introduce" },
          ]}
        />
      </Field>
    </Card>
  );
}

function PropertyStepView({ t, draft, update }: StepProps) {
  const showAddressFields =
    draft.side === "seller" || draft.propertyStatus === "selected";
  return (
    <Card pad={14}>
      {draft.side === "buyer" && (
        <>
          <SectionLabel t={t}>Property status</SectionLabel>
          <SegmentedRow
            t={t}
            options={[
              { value: "selected", label: "Selected" },
              { value: "still_searching", label: "Still searching" },
              { value: "multiple", label: "Multiple" },
            ]}
            value={draft.propertyStatus}
            onChange={(v) => update("propertyStatus", v as LeadDraft["propertyStatus"])}
          />
          <View style={{ height: 12 }} />
        </>
      )}

      {showAddressFields ? (
        <>
          <SectionLabel t={t}>{draft.side === "seller" ? "Property they're selling" : "Subject property"}</SectionLabel>
          <Field t={t} label="Street address" required>
            <Input t={t} value={draft.propertyAddress} onChangeText={(v) => update("propertyAddress", v)} placeholder="123 Main St" />
          </Field>
          <Field t={t} label="City">
            <Input t={t} value={draft.propertyCity} onChangeText={(v) => update("propertyCity", v)} placeholder="Brooklyn" />
          </Field>
          <Field t={t} label="State (USPS code)">
            <Input
              t={t}
              value={draft.propertyState}
              onChangeText={(v) => update("propertyState", v.toUpperCase().slice(0, 2))}
              placeholder="NY"
              autoCapitalize="characters"
            />
          </Field>
        </>
      ) : (
        <Text style={{ fontSize: 12.5, color: t.ink3, lineHeight: 19 }}>
          The buyer doesn't have a target property yet. We'll add address details
          once they pick one.
        </Text>
      )}
    </Card>
  );
}

function NumbersStepView({ t, draft, update }: StepProps) {
  if (draft.side === "seller") {
    return (
      <Card pad={14}>
        <Field t={t} label="Listing price" required>
          <Input t={t} value={draft.listingPrice} onChangeText={(v) => update("listingPrice", v)} placeholder="485,000" keyboardType="numeric" />
        </Field>
        <Field t={t} label="Target list date (YYYY-MM-DD)">
          <Input t={t} value={draft.targetListDate} onChangeText={(v) => update("targetListDate", v)} placeholder="2026-06-01" />
        </Field>
        <Field t={t} label="Target close date (if known)">
          <Input t={t} value={draft.targetCloseDate} onChangeText={(v) => update("targetCloseDate", v)} placeholder="2026-08-15" />
        </Field>
        <Text style={{ fontSize: 11, color: t.ink3, lineHeight: 16, marginTop: 4 }}>
          No loan numbers — this is a listing capture. Funding-team handoff is
          a separate action from the client page when applicable.
        </Text>
      </Card>
    );
  }
  return (
    <Card pad={14}>
      <SectionLabel t={t}>Target purchase price</SectionLabel>
      <SegmentedRow
        t={t}
        options={[
          { value: "exact", label: "Exact price" },
          { value: "range", label: "Price range" },
        ]}
        value={draft.priceMode}
        onChange={(v) => update("priceMode", v as LeadDraft["priceMode"])}
      />
      {draft.priceMode === "exact" ? (
        <View style={{ marginTop: 10 }}>
          <Input t={t} value={draft.purchasePrice} onChangeText={(v) => update("purchasePrice", v)} placeholder="485,000" keyboardType="numeric" />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Input t={t} value={draft.priceRangeLow} onChangeText={(v) => update("priceRangeLow", v)} placeholder="Min 400k" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input t={t} value={draft.priceRangeHigh} onChangeText={(v) => update("priceRangeHigh", v)} placeholder="Max 550k" keyboardType="numeric" />
          </View>
        </View>
      )}

      <View style={{ height: 12 }} />

      <Field t={t} label="Deposit available">
        <Input t={t} value={draft.depositAvailable} onChangeText={(v) => update("depositAvailable", v)} placeholder="125,000" keyboardType="numeric" />
      </Field>
      <Field t={t} label="Liquidity confidence">
        <PillRow
          t={t}
          value={draft.liquidityConfidence}
          onChange={(v) => update("liquidityConfidence", v as LeadDraft["liquidityConfidence"])}
          options={[
            { value: "confirmed", label: "Confirmed" },
            { value: "verbal", label: "Verbal" },
            { value: "unknown", label: "Unknown" },
          ]}
        />
      </Field>
      <Field t={t} label="Timeline">
        <PillRow
          t={t}
          value={draft.timeline}
          onChange={(v) => update("timeline", v)}
          options={TIMELINE_OPTIONS}
        />
      </Field>
      <Field t={t} label="Target close date (if known)">
        <Input t={t} value={draft.targetCloseDate} onChangeText={(v) => update("targetCloseDate", v)} placeholder="2026-08-15" />
      </Field>
    </Card>
  );
}

function HandoffStepView({ t, draft, update }: StepProps) {
  return (
    <Card pad={14}>
      <Field t={t} label="AI cadence preset">
        <SegmentedRow
          t={t}
          options={[
            { value: "gentle", label: "Gentle" },
            { value: "standard", label: "Standard" },
            { value: "aggressive", label: "Aggressive" },
          ]}
          value={draft.cadencePreset}
          onChange={(v) => update("cadencePreset", v as LeadDraft["cadencePreset"])}
        />
      </Field>
      <Field t={t} label="Handoff note (anything the funding team should know?)">
        <Input
          t={t}
          value={draft.handoffNote}
          onChangeText={(v) => update("handoffNote", v)}
          placeholder="They prefer SMS, husband is decision-maker, hoping to close before September…"
          multiline
        />
      </Field>
      <Text style={{ fontSize: 11, color: t.ink3, lineHeight: 16, marginTop: 4 }}>
        After save, fire "Ready for Prequalification" on the client page — or
        ask your AI Secretary — when you're ready to hand off to the funding
        team.
      </Text>
    </Card>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildLeadIntake(draft: LeadDraft): Record<string, unknown> {
  const property =
    draft.side === "seller" || draft.propertyStatus === "selected"
      ? {
          status: "selected",
          address: draft.propertyAddress.trim(),
          city: draft.propertyCity.trim(),
          state: draft.propertyState.trim().toUpperCase(),
        }
      : { status: draft.propertyStatus };

  const numbers =
    draft.side === "seller"
      ? {
          listing_price: parseDollars(draft.listingPrice),
          target_list_date: draft.targetListDate || null,
          target_close_date: draft.targetCloseDate || null,
        }
      : {
          price_mode: draft.priceMode,
          purchase_price: draft.priceMode === "exact" ? parseDollars(draft.purchasePrice) : null,
          price_range_low: draft.priceMode === "range" ? parseDollars(draft.priceRangeLow) : null,
          price_range_high: draft.priceMode === "range" ? parseDollars(draft.priceRangeHigh) : null,
          deposit_available: parseDollars(draft.depositAvailable),
          liquidity_confidence: draft.liquidityConfidence,
          timeline: draft.timeline,
          target_close_date: draft.targetCloseDate || null,
        };

  return {
    property,
    numbers,
    handoff_note: draft.handoffNote.trim() || null,
    cadence_preset: draft.cadencePreset,
  };
}

function parseDollars(s: string): number | null {
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// ── Primitives ──────────────────────────────────────────────────────────

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

function SectionLabel({ t, children }: { t: ReturnType<typeof useTheme>["t"]; children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: t.ink3, letterSpacing: 0.6, marginBottom: 8 }}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function Input({
  t, value, onChangeText, placeholder, keyboardType, autoCapitalize, multiline,
}: {
  t: ReturnType<typeof useTheme>["t"];
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "characters";
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.ink4}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "sentences"}
      multiline={multiline}
      style={{
        backgroundColor: t.surface2, color: t.ink, fontSize: 14,
        borderRadius: 10, paddingHorizontal: 12,
        paddingVertical: multiline ? 12 : 10,
        borderColor: t.line, borderWidth: 1,
        minHeight: multiline ? 80 : undefined,
        textAlignVertical: multiline ? "top" : "auto",
      }}
    />
  );
}

function SegmentedRow({
  t, options, value, onChange,
}: {
  t: ReturnType<typeof useTheme>["t"];
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              borderRadius: 9,
              alignItems: "center",
              backgroundColor: active ? t.brand : t.surface2,
              borderColor: active ? t.brand : t.line,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, fontWeight: "700", color: active ? "#fff" : t.ink }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Wrappable pill row for select-from-many (lead source, financing
// support, etc.). Pills wrap to a second row when they don't fit.
function PillRow({
  t, options, value, onChange,
}: {
  t: ReturnType<typeof useTheme>["t"];
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: active ? t.brand : t.surface2,
              borderColor: active ? t.brand : t.line,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : t.ink2 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
