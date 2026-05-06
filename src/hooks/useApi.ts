import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "./useAuthedFetch";
import { useSession } from "@/store/session";
import type {
  Loan,
  RecalcResponse,
  CreditPullStatus,
  CreditSummary,
  User,
  Client,
  RateSKU,
  Activity,
  Document,
  DocumentUploadInitResponse,
  AIChatRequest,
  AIChatResponse,
  CalendarEvent,
  DashboardReport,
  FredSeriesSummary,
} from "@/lib/types";

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

function isNotFound(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof NotFoundError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /\b404\b/.test(msg);
}

function useCacheKey() {
  return useSession((s) => s.devUser);
}

// /auth/me — canonical "who am I?". Mirrors qcdesktop's useCurrentUser:
// short staleTime + refetchOnWindowFocus so backend-side role changes
// (demote_to_client.py, Settings → Team) propagate within a tab-switch
// instead of taking 5 minutes.
//
// In React Native `refetchOnWindowFocus` only does anything when the app
// has wired focusManager to AppState — see app/_layout.tsx. Without that
// it's a no-op, but harmless.
export function useCurrentUser() {
  const fetcher = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["auth-me", isSignedIn],
    queryFn: () => fetcher<User>("/auth/me"),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
    enabled: isLoaded,
  });
}

// Backward-compat alias — older mobile screens import { useMe }. New code
// should use useCurrentUser to stay aligned with desktop naming.
export const useMe = useCurrentUser;

export function useRates() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["rates", key],
    queryFn: () => fetcher<RateSKU[]>("/rates"),
    staleTime: 60 * 1000,
  });
}

export function useLoans() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loans", key],
    queryFn: () => fetcher<Loan[]>("/loans"),
  });
}

export function useLoan(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loan", loanId, key],
    queryFn: () => fetcher<Loan>(`/loans/${loanId}`),
    enabled: !!loanId,
    // Poll every 15s so CLIENTs see operator/AI edits propagate without
    // a page refresh. Slice 3 will replace this with WebSocket push.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreditCurrent() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["credit", key],
    queryFn: () => fetcher<CreditPullStatus | null>("/credit/current"),
  });
}

// Backed by /clients/me. Returns the calling user's linked Client record
// (phone, address, city, tier, etc.). Used to pre-fill borrower-facing
// flows like the soft credit pull. 404 is expected for operator users
// with no client linkage — don't retry.
export function useMyClient() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["my-client", key],
    queryFn: () => fetcher<Client>("/clients/me"),
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

// Borrower-safe summary derived from the parsed credit report.
// Backend: GET /credit/pulls/{id}/summary.
export function useCreditSummary(pullId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["credit-summary", pullId, key],
    queryFn: () => fetcher<CreditSummary>(`/credit/pulls/${pullId}/summary`),
    enabled: !!pullId,
  });
}

export function useStartCreditPull() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  const key = useCacheKey();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher<CreditPullStatus>("/credit/pull", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      // The simulator reads from useMyCredit (queryKey ["my-credit", key])
      // while useCreditCurrent uses ["credit", key]. Populate BOTH caches
      // synchronously so the simulator unlocks immediately when the user
      // navigates back from the credit-pull screen, without waiting for a
      // background refetch. Then invalidate the prefixes to be safe.
      qc.setQueryData(["credit", key], data);
      qc.setQueryData(["my-credit", key], data);
      qc.invalidateQueries({ queryKey: ["credit"] });
      qc.invalidateQueries({ queryKey: ["my-credit"] });
    },
  });
}

export function useRecalc() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: ({
      loanId, discount_points, base_rate, loan_amount,
    }: { loanId: string; discount_points: number; base_rate?: number; loan_amount?: number }) =>
      fetcher<RecalcResponse>(`/loans/${loanId}/recalc`, {
        method: "POST",
        body: JSON.stringify({ discount_points, base_rate, loan_amount }),
      }),
  });
}

export function useLoanActivity(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["loanActivity", loanId, key],
    queryFn: () => fetcher<Activity[]>(`/loans/${loanId}/activity`),
    enabled: !!loanId,
  });
}

export function useDocuments(loanId: string | null | undefined) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["documents", loanId, key],
    queryFn: () => fetcher<Document[]>(loanId ? `/documents?loan_id=${loanId}` : "/documents"),
  });
}

// Upload a document to a specific loan. Two-step:
//   1. POST /documents/upload-init  → { document_id, upload_url (presigned S3) }
//   2. PUT the file blob to upload_url with x-amz-server-side-encryption: AES256
//
// In dev mode (no AWS keys on backend) upload_url is null — we still record
// metadata so the doc shows up in /documents. Mirrors qcdesktop's
// useUploadDocument but takes RN-style file refs (uri / name / mimeType).
export function useUploadDocument() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      loan_id: string;
      file: { uri: string; name: string; mimeType: string };
      category?: string;
    }) => {
      const init = await fetcher<DocumentUploadInitResponse>("/documents/upload-init", {
        method: "POST",
        body: JSON.stringify({
          loan_id: vars.loan_id,
          name: vars.file.name,
          content_type: vars.file.mimeType,
          category: vars.category,
        }),
      });
      if (init.upload_url) {
        // Read the file as a Blob from its local uri, then PUT it to S3.
        // RN's fetch handles file:// uris natively.
        const fileResp = await fetch(vars.file.uri);
        const blob = await fileResp.blob();
        const put = await fetch(init.upload_url, {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": vars.file.mimeType,
            "x-amz-server-side-encryption": "AES256",
          },
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status} ${put.statusText}`);
      }
      return init;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["documents", vars.loan_id] });
      qc.invalidateQueries({ queryKey: ["documents", undefined] });
      qc.invalidateQueries({ queryKey: ["documents", null] });
    },
  });
}

export function useAIChat() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: (payload: AIChatRequest) =>
      fetcher<AIChatResponse>("/ai/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

// /reports/dashboard — KPI tiles (funded YTD, pipeline value, avg close, pull-through)
export function useDashboardReport() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["dashboard-report", key],
    queryFn: () => fetcher<DashboardReport>("/reports/dashboard"),
    staleTime: 30 * 1000,
  });
}

// /calendar — agenda events (today + upcoming)
export function useCalendar() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["calendar", key],
    queryFn: () => fetcher<CalendarEvent[]>("/calendar"),
  });
}

// /fred/series — FRED-driven market rates with spreads.
// Mirrors qcdesktop's useFredSeries. The optional `days` argument (1..90)
// requests a wider history window for the rate-explorer chart; default
// (omit) returns the standard 30-day bundle. Days is part of the queryKey
// so different ranges cache independently.
export function useFredSeries(days?: number) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  const requested = days != null ? Math.max(1, Math.min(days, 90)) : undefined;
  const path = requested ? `/fred/series?days=${requested}` : "/fred/series";
  return useQuery({
    queryKey: ["fredSeries", key, requested ?? "default"],
    queryFn: () => fetcher<FredSeriesSummary[]>(path),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
  });
}

// Single-series with full history — used by detail screens that want to
// drill into one rate. Mirrors qcdesktop's useFredSeriesDetail.
export function useFredSeriesDetail(seriesId: string | null, days = 30) {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["fredSeries", seriesId, days, key],
    queryFn: () => fetcher<FredSeriesSummary>(`/fred/series/${seriesId}?days=${days}`),
    enabled: !!seriesId,
  });
}

// POST /loans/calc — loan-less what-if pricing. Mirrors qcdesktop's
// useFreeCalc so the mobile simulator can stop doing client-side math
// and use the same backend pricing engine the operator surface uses.
export function useFreeCalc() {
  const fetcher = useAuthedFetch();
  return useMutation({
    mutationFn: (body: {
      type: string;
      property_type?: string;
      loan_amount: number;
      base_rate: number;
      discount_points: number;
      term_months?: number | null;
      monthly_rent?: number | null;
      annual_taxes?: number;
      annual_insurance?: number;
      monthly_hoa?: number;
    }) =>
      fetcher<RecalcResponse>("/loans/calc", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// /credit/current?client_id=self — explicit "my own credit" lookup. Mirrors
// desktop's useMyCredit. The plain useCreditCurrent (no scope) works for
// any role; this version is the one to call from CLIENT-only flows so the
// intent is explicit in the code.
export function useMyCredit() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["my-credit", key],
    queryFn: () => fetcher<CreditPullStatus | null>("/credit/current?client_id=self"),
  });
}
