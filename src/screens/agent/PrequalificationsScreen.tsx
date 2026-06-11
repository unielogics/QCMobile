import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useTheme } from "@/design-system/ThemeProvider";
import { Card, Pill, SectionLabel } from "@/design-system/primitives";
import { QC_FMT } from "@/design-system/tokens";
import { TopBar } from "@/components/TopBar";
import { useAdminPrequalRequests } from "@/hooks/useApi";
import { PREQUAL_LOAN_TYPE_LABELS, type PrequalRequest, type PrequalStatus } from "@/lib/types";

type BrokerPrequalFilter = Extract<PrequalStatus, "pending" | "approved">;

const FILTERS: { value: BrokerPrequalFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
];

function activeFilter(raw: unknown): BrokerPrequalFilter {
  return raw === "approved" ? "approved" : "pending";
}

function dateLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusInfo(status: PrequalStatus, t: ReturnType<typeof useTheme>["t"]) {
  if (status === "approved") return { label: "Approved", bg: t.profitBg, fg: t.profit };
  if (status === "rejected") return { label: "Rejected", bg: t.dangerBg, fg: t.danger };
  if (status === "offer_accepted") return { label: "Loan opened", bg: t.brandSoft, fg: t.brand };
  if (status === "offer_declined") return { label: "Declined", bg: t.chip, fg: t.ink3 };
  return { label: "Pending", bg: t.warnBg, fg: t.warn };
}

function requestedAmount(req: PrequalRequest) {
  const approved = req.approved_loan_amount != null ? Number(req.approved_loan_amount) : null;
  return approved != null && req.status === "approved" ? approved : Number(req.requested_loan_amount);
}

export function PrequalificationsScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const filter = activeFilter(params.status);
  const { data: rows = [], isLoading } = useAdminPrequalRequests(filter);
  const { data: allRows = [] } = useAdminPrequalRequests(null);

  const counts = useMemo(() => ({
    pending: allRows.filter((row) => row.status === "pending").length,
    approved: allRows.filter((row) => row.status === "approved").length,
  }), [allRows]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <TopBar title="Prequalifications" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card pad={14}>
          <SectionLabel>Funding review</SectionLabel>
          <Text style={{ fontSize: 12.5, color: t.ink3, lineHeight: 18 }}>
            Pending and approved prequalification requests tied to your client book.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <SummaryTile
              label="Pending"
              value={counts.pending}
              active={filter === "pending"}
              color={counts.pending ? t.warn : t.ink}
              onPress={() => router.setParams({ status: "pending" })}
            />
            <SummaryTile
              label="Approved"
              value={counts.approved}
              active={filter === "approved"}
              color={counts.approved ? t.profit : t.ink}
              onPress={() => router.setParams({ status: "approved" })}
            />
          </View>
        </Card>

        <View>
          <SectionLabel>Filter</SectionLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => router.setParams({ status: item.value })}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? t.brand : t.line,
                    backgroundColor: active ? t.brandSoft : t.surface,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: active ? t.brand : t.ink2 }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <Card pad={14}>
            <Text style={{ fontSize: 12.5, color: t.ink3 }}>Loading prequalifications...</Text>
          </Card>
        ) : rows.length === 0 ? (
          <Card pad={14}>
            <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 19 }}>
              No {filter} prequalification requests for your clients.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((row) => (
              <PrequalQueueRow key={row.id} req={row} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryTile({
  label,
  value,
  active,
  color,
  onPress,
}: {
  label: string;
  value: number;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: active ? t.brand : t.line,
        backgroundColor: active ? t.brandSoft : t.surface2,
      }}
    >
      <Text style={{ fontSize: 10.5, fontWeight: "800", color: t.ink3, letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color, marginTop: 4 }}>{value}</Text>
    </Pressable>
  );
}

function PrequalQueueRow({ req }: { req: PrequalRequest }) {
  const { t } = useTheme();
  const router = useRouter();
  const status = statusInfo(req.status, t);
  const programLabel = PREQUAL_LOAN_TYPE_LABELS[req.loan_type]?.title ?? req.loan_type.replace(/_/g, " ");
  const closeDate = dateLabel(req.expected_closing_date);
  const created = dateLabel(req.created_at);
  const href = req.client_id
    ? (`/agent/client/${req.client_id}` as Href)
    : req.loan_id
      ? (`/agent/loan/${req.loan_id}` as Href)
      : null;

  return (
    <Pressable
      onPress={() => href && router.push(href)}
      disabled={!href}
      style={({ pressed }) => ({
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: pressed ? t.lineStrong : t.line,
        backgroundColor: t.surface,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pill bg={status.bg} color={status.fg}>{status.label}</Pill>
        <Pill bg={t.chip} color={t.ink2}>{programLabel}</Pill>
        {req.source_analysis_run_id ? <Pill bg={t.brandSoft} color={t.brand}>From analysis</Pill> : null}
      </View>
      <Text style={{ fontSize: 15, fontWeight: "900", color: t.ink, marginTop: 10 }} numberOfLines={2}>
        {req.client_name ?? "Client linked"}
      </Text>
      <Text style={{ fontSize: 12.5, color: t.ink2, marginTop: 3 }} numberOfLines={2}>
        {req.target_property_address || "Target property TBD"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 9 }}>
        <Meta label={req.status === "approved" ? "Amount" : "Requested"} value={QC_FMT.usd(requestedAmount(req), 0)} />
        {closeDate ? <Meta label="Close" value={closeDate} /> : null}
        {created ? <Meta label="Created" value={created} /> : null}
      </View>
    </Pressable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View>
      <Text style={{ fontSize: 10, fontWeight: "800", color: t.ink3, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12.5, fontWeight: "800", color: t.ink, marginTop: 1 }}>{value}</Text>
    </View>
  );
}
