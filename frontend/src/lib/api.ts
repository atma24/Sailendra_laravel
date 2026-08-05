const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }

  if (!res.ok || (body && body.success === false)) {
    throw new ApiError(
      body?.message || "Terjadi kesalahan pada server",
      res.status
    );
  }

  return body;
}

export const apiGet = <T = any>(path: string) => api<T>(path);
export const apiPost = <T = any>(path: string, data: any) =>
  api<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
  });