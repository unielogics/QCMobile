// Experience Vault — real-data version. Lists all the borrower's documents
// across every loan. Tap the FAB to upload: pick source (camera / library /
// file), pick a property to link the upload to, then PUT to S3 via
// /documents/upload-init.

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, SectionLabel, VerifiedBadge } from "@/design-system/primitives";
import { Icon } from "@/design-system/Icon";
import { TopBar } from "@/components/TopBar";
import { Fab } from "@/components/Fab";
import { UploadActionSheet, type PickedFile } from "@/components/sheets/UploadActionSheet";
import { PropertyPickerSheet } from "@/components/sheets/PropertyPickerSheet";
import { useDocuments, useLoans, useUploadDocument } from "@/hooks/useApi";
import type { Document, Loan } from "@/lib/types";

type DocStatus = Document["status"];

function statusKind(status: DocStatus): "verified" | "pending" | "flagged" {
  if (status === "verified" || status === "received") return "verified";
  if (status === "flagged") return "flagged";
  return "pending";
}

export default function Vault() {
  const { t } = useTheme();
  const { data: docs = [], isLoading } = useDocuments(null);
  const { data: loans = [] } = useLoans();
  const upload = useUploadDocument();

  // Upload flow state
  const [showAction, setShowAction] = useState(false);
  const [showProperty, setShowProperty] = useState(false);
  const [pendingFile, setPendingFile] = useState<PickedFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Stats — derived from real docs
  const stats = useMemo(() => {
    const total = docs.length;
    const verified = docs.filter((d) => d.status === "verified").length;
    const flagged = docs.filter((d) => d.status === "flagged").length;
    return { total, verified, flagged };
  }, [docs]);

  const onPicked = (file: PickedFile) => {
    setShowAction(false);
    setPendingFile(file);
    setUploadError(null);
    if (loans.length === 0) {
      setUploadError("Start a loan first — uploads need to be linked to a property.");
      setPendingFile(null);
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
      });
      setPendingFile(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setPendingFile(null);
    }
  };

  const onCancelProperty = () => {
    setShowProperty(false);
    setPendingFile(null);
  };

  // Group docs by loan
  const groupedByLoan = useMemo(() => {
    const map = new Map<string, { loan: Loan | undefined; docs: Document[] }>();
    for (const d of docs) {
      if (!map.has(d.loan_id)) {
        map.set(d.loan_id, { loan: loans.find((l) => l.id === d.loan_id), docs: [] });
      }
      map.get(d.loan_id)!.docs.push(d);
    }
    return Array.from(map.entries());
  }, [docs, loans]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Experience" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
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

        {/* Upload CTA */}
        <Pressable
          onPress={() => setShowAction(true)}
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
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>Upload Experience Doc</Text>
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

        {!isLoading && docs.length === 0 ? (
          <Card pad={24} style={{ marginBottom: 14, alignItems: "center" }}>
            <Icon name="vault" size={32} color={t.ink4} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: t.ink2, marginTop: 12, textAlign: "center" }}>
              Your vault is empty
            </Text>
            <Text style={{ fontSize: 12, color: t.ink3, marginTop: 6, textAlign: "center", lineHeight: 17 }}>
              Upload HUDs from past closings or photos of properties you own. Each upload links to a property in your portfolio.
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

      <Fab onPress={() => setShowAction(true)} icon="plus" />

      <UploadActionSheet
        visible={showAction}
        onClose={() => setShowAction(false)}
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
