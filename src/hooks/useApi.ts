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
  PrequalRequest,
  PrequalRequestCreate,
  PrequalSellerOutcome,
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

// Single canonical credit hook used by /profile, /home, /simulator, and
// /credit-pull. ALL of these need to see the same source of truth — when
// the borrower pulls credit on desktop and reopens mobile, every screen
// should reflect it without refetching individually.
//
// Previously we had two hooks (useCreditCurrent + useMyCredit) with
// DIFFERENT queryKeys hitting the SAME endpoint. The backend ignores the
// client_id query param and just uses user.client.id, so the responses
// are identical, but react-query treated them as separate caches —
// causing profile to show the score while home/simulator stayed gated.
//
// This consolidates: both names point at the same useQuery so any
// consumer's mount/refocus refetch warms the cache for everyone else.
export function useCreditCurrent() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  // Gate on Clerk readiness — useAuthedFetch returns a never-resolving
  // promise while Clerk is still loading, which would otherwise leave
  // this query stuck in `pending` forever for any screen that mounts
  // before sign-in finishes (notably the Home tab, which is the default).
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ["credit-current", key],
    queryFn: () => fetcher<CreditPullStatus | null>("/credit/current"),
    enabled: isLoaded,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
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
      // useMyCredit / useCreditCurrent are now a single hook backed by
      // queryKey ["credit-current", key]. Seed it so the simulator
      // unlocks immediately when the user navigates back from credit-pull.
      // We also leave the legacy invalidations in place in case any other
      // module was caching under those older prefixes.
      qc.setQueryData(["credit-current", key], data);
      qc.invalidateQueries({ queryKey: ["credit-current"] });
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
    // Borrower hits the tab expecting fresh status — emitter-driven
    // events (doc due, closing day, etc.) appear without a manual
    // refresh.
    staleTime: 30 * 1000,
  });
}

// PATCH /calendar/{id} — mark done / re-open. Borrowers may only flip
// status; backend enforces. Operators can also patch title/who/etc.
export function useUpdateCalendarEvent() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        status: "pending" | "done" | "cancelled";
        title: string;
        description: string | null;
        starts_at: string;
        priority: "low" | "medium" | "high" | null;
      }>;
    }) =>
      fetcher<CalendarEvent>(`/calendar/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
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
  // Same Clerk-readiness gate as useCreditCurrent — the home tab mounts
  // before sign-in finishes, and a never-resolving promise from the
  // pre-Clerk fetcher would leave the rate strip stuck on "—".
  const { isLoaded } = useAuth();
  const requested = days != null ? Math.max(1, Math.min(days, 90)) : undefined;
  const path = requested ? `/fred/series?days=${requested}` : "/fred/series";
  return useQuery({
    queryKey: ["fredSeries", key, requested ?? "default"],
    queryFn: () => fetcher<FredSeriesSummary[]>(path),
    enabled: isLoaded,
    // Previously: 5-min staleTime + 1-retry cap meant a single transient
    // 401 (e.g. during a sign-in race) left the hook stuck on the cached
    // error for 5 min — and the user saw "market rates not loading".
    // Now: 60s staleTime, retry up to 3 times on transport errors,
    // refetch on every mount so navigating back to home/calculator
    // always re-attempts.
    staleTime: 60 * 1000,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 3,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
// Alias for useCreditCurrent — same cache, same data. Kept as a separate
// name only so existing callers don't have to be touched. New code should
// prefer useCreditCurrent directly. See the comment on useCreditCurrent
// for the consolidation rationale.
export function useMyCredit() {
  return useCreditCurrent();
}

// ── Pre-qualification letters (borrower-only on mobile) ───────────────
// Mirrors QCDashboard hooks. Mobile only ships the borrower flow:
// submit, list, and report-back the seller's outcome. No admin queue,
// no review modal — operators stay on desktop.

export function useMyPrequalRequests() {
  const fetcher = useAuthedFetch();
  const key = useCacheKey();
  return useQuery({
    queryKey: ["prequal-requests", "me", key],
    queryFn: () => fetcher<PrequalRequest[]>("/me/prequal-requests"),
    // Borrower opens the app expecting fresh status — pending may have
    // flipped to approved while they were away.
    staleTime: 30 * 1000,
  });
}

export function useSubmitPrequalRequest() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrequalRequestCreate) =>
      fetcher<PrequalRequest>("/prequal-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
    },
  });
}

export function useAcceptPrequalOffer() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: PrequalSellerOutcome }) =>
      fetcher<PrequalRequest>(`/me/prequal-requests/${requestId}/accept-offer`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
      // Acceptance spawns a Loan — refresh the borrower's loan list so
      // it appears in the My Loans section under the prequal section.
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useDeclinePrequalOffer() {
  const fetcher = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, payload }: { requestId: string; payload: PrequalSellerOutcome }) =>
      fetcher<PrequalRequest>(`/me/prequal-requests/${requestId}/decline-offer`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prequal-requests"] });
    },
  });
}
