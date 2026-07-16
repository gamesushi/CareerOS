"use client";

import { toast } from "sonner";

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { silent?: boolean },
): Promise<T | null> {
  const res = await fetch(`/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      /* keep default */
    }
    if (!options?.silent) toast.error(message);
    return null;
  }
  return (await res.json()) as T;
}

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export const fmtRange = (start: string | Date, end?: string | Date | null) =>
  `${fmtDate(start).slice(0, 7)} ~ ${end ? fmtDate(end).slice(0, 7) : "至今"}`;
