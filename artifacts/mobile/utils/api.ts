const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
export const API_BASE = domain ? `https://${domain}/api` : "/api";

export function getAdminUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_ADMIN_URL;
  if (explicit) return explicit;
  if (domain) return `https://${domain}/api/admin`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/admin`;
  }
  return "/api/admin";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message);
    this.name = "NetworkError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}
