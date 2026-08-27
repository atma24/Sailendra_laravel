export const DIRECT_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.jtatrack.com";

export function getUploadUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return `${DIRECT_BACKEND_URL}${cleanPath}`;
  }
  return cleanPath;
}

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ApiEnvelope<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("sailendra_session");
    if (!raw) return {};
    const s = JSON.parse(raw);
    if (s?.token) {
      const headers: HeadersInit = {
        Accept: "application/json",
        Authorization: `Bearer ${s.token}`,
      };
      if (s.session_token) {
        headers["X-Session-Token"] = s.session_token;
      }
      return headers;
    }
  } catch {
    /* ignore */
  }
  return { Accept: "application/json" };
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }

  if (!res.ok || (body && body.success === false)) {
    if (res.status === 401) {
      // Clear session and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("sailendra_session");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    const msg = body?.message || "Terjadi kesalahan pada server";
    throw new ApiError(msg, res.status);
  }

  if (!body) {
    throw new ApiError("Respons tidak valid dari server", res.status);
  }

  return body;
}

export const apiGet = <T = unknown>(path: string) => api<T>(path);

export const apiPost = <T = unknown>(path: string, data: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(data) });
