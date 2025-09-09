const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export type UrlRow = {
  id: number;
  url: string;
  expected_status: number;
  threshold_slow_ms: number;
  created_at: string;
};

export type CheckRow = {
  id: number;
  url_id: number;
  status_code?: number | null;
  latency_ms?: number | null;
  ok: boolean;
  error?: string | null;
  checked_at: string;
};

export async function fetchURLs(): Promise<UrlRow[]> {
  const res = await fetch(`${API}/urls`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch URLs");
  return res.json();
}

export async function fetchChecks(url_id: number, limit = 50): Promise<CheckRow[]> {
  const res = await fetch(`${API}/checks?url_id=${url_id}&limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch checks");
  return res.json();
}

export async function fetchLatestStatus(): Promise<
  { url: UrlRow; check: CheckRow }[]
> {
  // optional; only if you implement /status
  const res = await fetch(`${API}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function addURL(payload: { url: string; expected_status?: number; slow_ms?: number }) {
  const res = await fetch(`${API}/urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to add URL");
  return res.json() as Promise<{ id: number }>;
}

export async function deleteURL(id: number) {
  const res = await fetch(`${API}/urls/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete URL");
  return res.json() as Promise<{ success: boolean }>;
}
