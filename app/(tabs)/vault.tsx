// Vault — split into two tabs:
//   experience    — proof of past deals (HUDs, closings, deeds, prior leases)
//   active_asset  — currently-owned real estate (bank notes, current leases,
//                   insurance, tax bills)
//
// Upload flow: tap FAB → pick KIND (experience | active_asset) → pick SOURCE
// (camera / library / file) → pick PROPERTY (loan) → PUT to S3 via
// /documents/upload-init. The kind becomes Document.category upstream so
// the tabs can filter.

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, SectionLabel, VerifiedBadge } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { Fab } from "@/components/Fab";
import { UploadKindSheet, type UploadKind } from "@/components/sheets/UploadKindSheet";
import { UploadActionSheet, type PickedFile } from "@/components/sheets/UploadActionSheet";
import { PropertyPickerSheet } from "@/components/sheets/PropertyPickerSheet";
import { useDocuments, useLoans, useUploadDocument } from "@/hooks/useApi";
import type { Document, Loan } from "@/lib/types";

type DocStatus = Document["status"];
type VaultTab = "experience" | "active_asset";

function statusKind(status: DocStatus): "verified" | "pending" | "flagged" {
  if (status === "verified" || status === "received") return "verified";
  if (status === "flagged") return "flagged";
  return "pending";
}

// Match a doc to a tab. Uncategorized legacy uploads default to the
// "experience" tab since that's what the vault was historically used for.
function tabFor(category: string | null | undefined): VaultTab {
  if (category === "active_asset") return "active_asset";
  return "experience";
}

export default function Vault() {
  const { t } = useTheme();
  const { data: docs = [], isLoading } = useDocuments(null);
  const { data: loans = [] } = useLoans();
  const upload = useUploadDocument();

  // Active tab
  const [tab, setTab] = useState<VaultTab>("experience");

  // Upload flow state
  const [showKind, setShowKind] = useState(false);
  const [showAction, setShowAction] = useState(false);
  const [showProperty, setShowProperty] = useState(false);
  const [pendingKind, setPendingKind] = useState<UploadKind | null>(null);
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter docs by active tab (kept stable so we can derive both stats
  // and the grouped list from the same source).
  const tabDocs = useMemo(() => docs.filter((d) => tabFor(d.category) === tab), [docs, tab]);

  // Stats — derived from the active tab's docs only, so the headline
  // numbers reflect the section the user is looking at.
  const stats = useMemo(() => {
    const total = tabDocs.length;
    const verified = tabDocs.filter((d) => d.status === "verified").length;
    const flagged = tabDocs.filter((d) => d.status === "flagged").length;
    return { total, verified, flagged };
  }, [tabDocs]);

  // Tab counts for the header pills (so the user sees how many docs
  // live behind the OTHER tab without having to switch).
  const tabCounts = useMemo(() => ({
    experience: docs.filter((d) => tabFor(d.category) === "experience").length,
    active_asset: docs.filter((d) => tabFor(d.category) === "active_asset").length,
  }), [docs]);

  // Upload flow: FAB / dashed CTA → kind sheet → action sheet → property picker.
  const onPickKind = (kind: UploadKind) => {
    setShowKind(false);
    setPendingKind(kind);
    setUploadError(null);
    setShowAction(true);
  };

  const onPicked = (file: PickedFile) => {
    setShowAction(false);
    setPendingFile(file);
    setUploadError(null);
    if (loans.length === 0) {
      setUploadError("Start a loan first — uploads need to be linked to a property.");
      setPendingFile(null);
      setPendingKind(null);
      return;
    }
    setShowProperty(true);
  };

  const onPickProperty = async (loan: Loan) => {
    setShowProperty(false);
    if (!pendingFile) return;
    try {
      await upload.mutateAsync({
        loan_id: loan.id,
        file: pendingFile,
        category: pendingKind ?? undefined,
      });
      // Snap the active tab to the kind we just uploaded so the user
      // sees their new doc immediately instead of looking at the wrong list.
      if (pendingKind) setTab(pendingKind);
      setPendingFile(null);
      setPendingKind(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setPendingFile(null);
      setPendingKind(null);
    }
  };

  const onCancelProperty = () => {
    setShowProperty(false);
    setPendingFile(null);
    setPendingKind(null);
  };

  const onCancelAction = () => {
    setShowAction(false);
    setPendingKind(null);
  };

  // Group active-tab docs by loan
  const groupedByLoan = useMemo(() => {
    const map = new Map<string, { loan: Loan | undefined; docs: Document[] }>();
    for (const d of tabDocs) {
      if (!map.has(d.loan_id)) {
        map.set(d.loan_id, { loan: loans.find((l) => l.id === d.loan_id), docs: [] });
      }
      map.get(d.loan_id)!.docs.push(d);
    }
    return Array.from(map.entries());
  }, [tabDocs, loans]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Vault" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Tab switcher */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: t.surface2,
            borderRadius: 12,
            padding: 4,
            marginBottom: 14,
            gap: 4,
          }}
        >
          <TabButton
            t={t}
            label="Experience"
            count={tabCounts.experience}
            active={tab === "experience"}
            onPress={() => setTab("experience")}
          />
          <TabButton
            t={t}
            label="Active assets"
            count={tabCounts.active_asset}
            active={tab === "active_asset"}
            onPress={() => setTab("active_asset")}
          />
        </View>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Card pad={12} style={{ flex: 1 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, color: t.ink3, textTransform: "uppercase" }}>Documents</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 2, color: t.ink, letterSpacing: -0.5 }}>
              {stats.total}
            </Text>
          </Card>
          <Card pad={12} style={{ flex: 1 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, color: t.ink3, textTransform: "uppercase" }}>Verified</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 2, color: t.profit, letterSpacing: -0.5 }}>
              {stats.verified}
            </Text>
          </Card>
          <Card pad={12} style={{ flex: 1 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, color: t.ink3, textTransform: "uppercase" }}>Flagged</Text>
            <Text style={{ fontSize: 22, fontWeight: "700", marginTop: 2, color: stats.flagged > 0 ? t.danger : t.ink, letterSpacing: -0.5 }}>
              {stats.flagged}
            </Text>
          </Card>
        </View>

        {/* Upload CTA — opens the kind picker first */}
        <Pressable
          onPress={() => setShowKind(true)}
          disabled={upload.isPending}
          style={({ pressed }) => ({
            paddingVertical: 14, paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1.5, borderStyle: "dashed", borderColor: t.lineStrong,
            backgroundColor: "transparent",
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            marginBottom: 14,
            opacity: pressed || upload.isPending ? 0.7 : 1,
          })}
        >
          {upload.isPending ? (
            <>
              <ActivityIndicator color={t.ink2} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>Uploading…</Text>
            </>
          ) : (
            <>
              <Icon name="scan" size={18} color={t.ink} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>
                Upload {tab === "active_asset" ? "Asset Doc" : "Experience Doc"}
              </Text>
              <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "500" }}>· AI verifies on the server</Text>
            </>
          )}
        </Pressable>

        {/* Errors */}
        {uploadError ? (
          <Card pad={12} style={{ marginBottom: 14, backgroundColor: t.dangerBg, borderColor: `${t.danger}40` }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Icon name="alert" size={14} color={t.danger} />
              <Text style={{ flex: 1, fontSize: 12, color: t.danger, fontWeight: "700" }}>{uploadError}</Text>
              <Pressable onPress={() => setUploadError(null)}>
                <Icon name="x" size={14} color={t.danger} />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Empty / loading */}
        {isLoading ? (
          <Card pad={32} style={{ marginBottom: 14, alignItems: "center" }}>
            <ActivityIndicator color={t.ink3} />
            <Text style={{ fontSize: 12, color: t.ink3, marginTop: 8 }}>Loading vault…</Text>
          </Card>
        ) : null}

        {!isLoading && tabDocs.length === 0 ? (
          <Card pad={24} style={{ marginBottom: 14, alignItems: "center" }}>
            <Icon name="vault" size={32} color={t.ink4} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink2, marginTop: 12, textAlign: "center" }}>
              {tab === "active_asset" ? "No active assets yet" : "No experience proof yet"}
            </Text>
            <Text style={{ fontSize: 12, color: t.ink3, marginTop: 6, textAlign: "center", lineHeight: 17 }}>
              {tab === "active_asset"
                ? "Upload bank notes, leases, insurance, or tax bills for properties you currently own."
                : "Upload HUDs, closing statements, deeds, or prior leases from past deals to count toward your investor experience tier."}
            </Text>
          </Card>
        ) : null}

        {/* Grouped by loan */}
        {groupedByLoan.map(([loanId, { loan, docs: groupDocs }]) => (
          <View key={loanId} style={{ marginBottom: 16 }}>
            <SectionLabel
              action={
                loan ? (
                  <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>
                    {loan.deal_id} · {groupDocs.length}
                  </Text>
                ) : undefined
              }
            >
              {loan ? loan.address : `Loan ${loanId.slice(0, 8)}`}
            </SectionLabel>
            <Card pad={0}>
              {groupDocs.map((d, i) => (
                <DocRow key={d.id} doc={d} isLast={i === groupDocs.length - 1} />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>

      <Fab onPress={() => setShowKind(true)} icon="plus" />

      <UploadKindSheet
        visible={showKind}
        onClose={() => setShowKind(false)}
        onPick={onPickKind}
      />

      <UploadActionSheet
        visible={showAction}
        onClose={onCancelAction}
        onPicked={onPicked}
      />

      <PropertyPickerSheet
        visible={showProperty}
        loans={loans}
        fileName={pendingFile?.name}
        onClose={onCancelProperty}
        onPick={onPickProperty}
      />
    </SafeAreaView>
  );
}

function TabButton({
  t,
  label,
  count,
  active,
  onPress,
}: {
  t: ReturnType<typeof useTheme>["t"];
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 9,
        borderRadius: 9,
        backgroundColor: active ? t.bg : "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: active ? t.ink : t.ink2 }}>
        {label}
      </Text>
      <View
        style={{
          minWidth: 20,
          height: 18,
          paddingHorizontal: 6,
          borderRadius: 9,
          backgroundColor: active ? t.brandSoft : t.line,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 10.5, fontWeight: "700", color: active ? t.brand : t.ink3 }}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function DocRow({ doc, isLast }: { doc: Document; isLast: boolean }) {
  const { t } = useTheme();
  const kind = statusKind(doc.status);
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 12, paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
        <Icon name={doc.s3_key?.toLowerCase().match(/\.(jpe?g|png|heic|webp)$/) ? "scan" : "doc"} size={15} color={t.ink2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "700", color: t.ink }}>{doc.name}</Text>
        <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>
          {doc.category ?? "uncategorized"}
          {doc.received_on ? ` · received ${new Date(doc.received_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          {doc.requested_on && !doc.received_on ? ` · requested ${new Date(doc.requested_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </Text>
      </View>
      <VerifiedBadge kind={kind} />
    </View>
  );
}
