import type { SessionUser } from "@cpj/contracts";

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, cache: "no-store", credentials: "include", headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Layanan tidak tersedia" })) as { message?: string };
    throw new ApiError(payload.message ?? "Permintaan gagal", response.status);
  }
  return response.json() as Promise<T>;
};

export const getSession = () => api<{ user: SessionUser }>("/auth/me");
