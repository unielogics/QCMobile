// Borrower-facing pre-qualification request sheet (mobile mirror of
// QCDashboard's PreQualRequestModal).
//
// Submitting does NOT spawn a Loan — the request lives standalone until
// the borrower confirms the seller accepted their offer. The LLC field
// has a "TBD — letter to my individual name" toggle for borrowers who
// haven't formed the entity yet.

import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/design-system/ThemeProvider";
import { Icon } from "@/design-system/Icon";
import { Pill, QButton } from "@/design-system/primitives";
import { useSubmitPrequalRequest } from "@/hooks/useApi";
import type { PrequalLoanType } from "@/lib/types";

const LTV_CAPS: Record<PrequalLoanType, number> = { dscr: 0.8, bridge: 0.85 };

interface Props {
  visible: boolean;
  onClose: () => void;
  // Optional pre-fills — when opened from a loan-detail context.
  initialAddress?: string;
  initialLoanType?: PrequalLoanType;
}

export function PreQualRequestSheet({
  visible,
  onClose,
  initialAddress,
  initialLoanType,
}: Props) {
  const { t } = useTheme();
  const submit = useSubmitPrequalRequest();

  const [loanType, setLoanType] = useState<PrequalLoanType>(initialLoanType ?? "dscr");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [purchaseText, setPurchaseText] = useState("");
  const [loanText, setLoanText] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [entityTBD, setEntityTBD] = useState(true);
  const [entityName, setEntityName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [doneFlash, setDoneFlash] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoanType(initialLoanType ?? "dscr");
      setAddress(initialAddress ?? "");
      setPurchaseText("");
      setLoanText("");
      setClosingDate("");
      setNotes("");
      setEntityTBD(true);
      setEntityName("");
      setError(null);
      setDoneFlash(false);
    }
  }, [visible, initialAddress, initialLoanType]);

  const purchaseNum = Number(purchaseText.replace(/[^0-9.]/g, "")) || 0;
  const loanNum = Number(loanText.replace(/[^0-9.]/g, "")) || 0;
  const ltv = purchaseNum > 0 ? loanNum / purchaseNum : 0;
  const cap = LTV_CAPS[loanType];
  const ltvOverCap = ltv > cap + 1e-6;
  const formValid = address.trim().length >= 3 && purchaseNum > 0 && loanNum > 0;

  const onSubmit = async () => {
    setError(null);
    if (!formValid) {
      setError("Please fill in property address, purchase price, and requested loan amount.");
      return;
    }
    try {
      await submit.mutateAsync({
        target_property_address: address.trim(),
        purchase_price: purchaseNum,
        requested_loan_amount: loanNum,
        loan_type: loanType,
        // Closing date is optional. Backend expects ISO yyyy-mm-dd or
        // null; if the borrower types something we trust them and pass
        // it through. If the format is bad the backend 422s and we
        // surface it.
        expected_closing_date: closingDate.trim() || null,
        borrower_notes: notes.trim() || null,
        borrower_entity: entityTBD ? null : (entityName.trim() || null),
      });
      setDoneFlash(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed — please retry.");
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(6,7,11,0.55)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              backgroundColor: t.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 18,
              paddingTop: 12,
              paddingBottom: 24,
              maxHeight: "92%",
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.lineStrong, alignSelf: "center", marginBottom: 14 }} />

            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: t.petrol, letterSpacing: 1.4, textTransform: "uppercase" }}>
                  Underwriter review · async
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "700", color: t.ink, letterSpacing: -0.4, marginTop: 2 }}>
                  Request Pre-Qualification
                </Text>
                <Text style={{ fontSize: 12, color: t.ink3, marginTop: 4, lineHeight: 17 }}>
                  Letters are issued by an underwriter — never auto-generated.
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: t.chip, alignItems: "center", justifyContent: "center" }}
                accessibilityLabel="Close"
              >
                <Icon name="x" size={16} color={t.ink2} />
              </Pressable>
            </View>

            {doneFlash ? (
              <View style={{ alignItems: "center", paddingVertical: 28, gap: 10 }}>
                <Pill bg={t.profitBg} color={t.profit}>Submitted</Pill>
                <Text style={{ fontSize: 16, fontWeight: "800", color: t.ink }}>Under review</Text>
                <Text style={{ fontSize: 12.5, color: t.ink3, textAlign: "center", lineHeight: 18, paddingHorizontal: 12 }}>
                  An underwriter will review your request and either approve with a
                  signed letter or send back notes. You&apos;ll see the status update
                  here when they&apos;re done.
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 14, paddingBottom: 8, gap: 14 }} showsVerticalScrollIndicator={false}>
                {/* Loan program */}
                <View>
                  <FieldLabel t={t}>Loan program</FieldLabel>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(
                      [
                        { id: "dscr" as const,   title: "DSCR Rental",   sub: "30-yr fixed" },
                        { id: "bridge" as const, title: "Bridge",         sub: "Short-term" },
                      ]
                    ).map((opt) => {
                      const active = loanType === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setLoanType(opt.id)}
                          style={({ pressed }) => ({
                            flex: 1,
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: active ? t.brand : t.line,
                            backgroundColor: active ? t.brandSoft : t.surface2,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{opt.title}</Text>
                          <Text style={{ fontSize: 11, color: t.ink2, marginTop: 2 }}>{opt.sub}</Text>
                          <Text style={{ fontSize: 9.5, color: t.ink3, marginTop: 4, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                            Max LTV {Math.round(LTV_CAPS[opt.id] * 100)}%
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Address */}
                <FieldText
                  t={t}
                  label="Target property address"
                  value={address}
                  onChange={setAddress}
                  placeholder="123 Main St, Anytown, NJ 07026"
                />

                {/* Purchase + loan */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <FieldText
                      t={t}
                      label="Purchase price"
                      value={purchaseText}
                      onChange={setPurchaseText}
                      placeholder="400000"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldText
                      t={t}
                      label="Requested loan"
                      value={loanText}
                      onChange={setLoanText}
                      placeholder="320000"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Live LTV pill */}
                {purchaseNum > 0 && loanNum > 0 ? (
                  <Pill
                    bg={ltvOverCap ? t.dangerBg : t.profitBg}
                    color={ltvOverCap ? t.danger : t.profit}
                  >
                    {`Requested LTV ${(ltv * 100).toFixed(1)}% · ${ltvOverCap
                      ? `over ${Math.round(cap * 100)}% cap — underwriter will adjust`
                      : `within ${Math.round(cap * 100)}% cap`}`}
                  </Pill>
                ) : null}

                {/* Closing date — plain text (no native date picker dependency) */}
                <FieldText
                  t={t}
                  label="Expected closing date (YYYY-MM-DD)"
                  value={closingDate}
                  onChange={setClosingDate}
                  placeholder="2026-06-15"
                  autoCapitalize="none"
                />

                {/* LLC / entity */}
                <View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: t.ink3, letterSpacing: 1.0, textTransform: "uppercase" }}>
                      LLC / entity name
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 11.5, color: t.ink2 }}>TBD</Text>
                      <Switch
                        value={entityTBD}
                        onValueChange={setEntityTBD}
                        trackColor={{ false: t.line, true: t.brand }}
                      />
                    </View>
                  </View>
                  {!entityTBD ? (
                    <TextInput
                      value={entityName}
                      onChangeText={setEntityName}
                      placeholder="e.g. Riverside Holdings LLC"
                      placeholderTextColor={t.ink4}
                      style={inputStyle(t)}
                    />
                  ) : (
                    <View style={{
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.line,
                      borderStyle: "dashed",
                      borderRadius: 9,
                      padding: 10,
                    }}>
                      <Text style={{ fontSize: 11.5, color: t.ink3, lineHeight: 16 }}>
                        Letter will be issued to your individual legal name. The
                        underwriter can re-issue under your LLC once it&apos;s formed.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Borrower notes */}
                <View>
                  <FieldLabel t={t}>Borrower notes (optional)</FieldLabel>
                  <TextInput
                    value={notes}
                    onChangeText={(v) => setNotes(v.slice(0, 500))}
                    placeholder="e.g. Need this letter by Friday EOD to submit my offer."
                    placeholderTextColor={t.ink4}
                    multiline
                    style={[inputStyle(t), { minHeight: 70, textAlignVertical: "top" }]}
                  />
                  <Text style={{ fontSize: 10, color: t.ink4, marginTop: 4, textAlign: "right" }}>
                    {notes.length}/500
                  </Text>
                </View>

                {error ? (
                  <Pill bg={t.dangerBg} color={t.danger}>{error}</Pill>
                ) : null}

                <View style={{ marginTop: 4, gap: 10 }}>
                  <QButton
                    label={submit.isPending ? "Submitting…" : "Submit for review"}
                    onPress={onSubmit}
                    disabled={!formValid || submit.isPending}
                    icon="check"
                    variant="primary"
                  />
                  <Text style={{ fontSize: 11, color: t.ink3, lineHeight: 15.5 }}>
                    Submitting just opens an underwriter review — no loan file is
                    created yet. Once approved, you&apos;ll download the letter, present
                    the offer, and report back here whether the seller accepted.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function FieldLabel({ t, children }: { t: ReturnType<typeof useTheme>["t"]; children: React.ReactNode }) {
  return (
    <Text style={{
      fontSize: 10.5, fontWeight: "700", color: t.ink3,
      letterSpacing: 1.0, textTransform: "uppercase", marginBottom: 5,
    }}>
      {children}
    </Text>
  );
}

function FieldText({
  t,
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  t: ReturnType<typeof useTheme>["t"];
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View>
      <FieldLabel t={t}>{label}</FieldLabel>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.ink4}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={inputStyle(t)}
      />
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTheme>["t"]) {
  return {
    backgroundColor: t.surface2,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: t.ink,
  } as const;
}
