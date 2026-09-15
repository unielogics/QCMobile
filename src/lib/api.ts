import Constants from "expo-constants";

// Production-safe default — Expo Go on a real device, EAS builds, and App
// Store binaries all hit the deployed backend without any extra config.
// Override locally via .env (`EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`
// for a LAN-reachable host) or app.json `extra.apiUrl`. NEVER default to
// localhost — mobile devices can't reach the build host's loopback.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "https://api.qualifiedcommercial.com";

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export const PASSWORD_PROTECTED_PDF_UPLOAD_CODE = "password_protected_pdf";

export function apiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return undefined;
  const detail = "detail" in error.body ? (error.body as { detail?: unknown }).detail : undefined;
  if (!detail || typeof detail !== "object" || !("code" in detail)) return undefined;
  return typeof detail.code === "string" ? detail.code : undefined;
}

export function apiErrorFileId(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return undefined;
  const detail = "detail" in error.body ? (error.body as { detail?: unknown }).detail : undefined;
  if (!detail || typeof detail !== "object" || !("file_id" in detail)) return undefined;
  return typeof detail.file_id === "string" ? detail.file_id : undefined;
}

export interface ApiOptions extends RequestInit {
  devUser?: string;
  authToken?: string;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { devUser, authToken, headers, cache, ...rest } = opts;
  const method = String(rest.method ?? "GET").toUpperCase();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...rest,
    cache: cache ?? (method === "GET" ? "no-store" : undefined),
    headers: {
      "Content-Type": "application/json",
      ...(devUser ? { "X-Dev-User": devUser } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const fallback = `${res.status} ${res.statusText}`;
    const detail = body && typeof body === "object" && "detail" in body
      ? (body as { detail?: unknown }).detail
      : null;
    const nestedMessage = detail && typeof detail === "object" && "message" in detail
      ? (detail as { message?: unknown }).message
      : null;
    const fieldMessage = Array.isArray(detail)
      ? detail
          .map((item) => item && typeof item === "object" && "msg" in item ? String((item as { msg?: unknown }).msg ?? "") : "")
          .filter(Boolean)
          .join("; ")
      : "";
    const message = typeof detail === "string" && detail.trim()
      ? detail
      : typeof nestedMessage === "string" && nestedMessage.trim()
        ? nestedMessage
        : fieldMessage || fallback;
    throw new ApiError(res.status, message, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiBase = API_URL;
