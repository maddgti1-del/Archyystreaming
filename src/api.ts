const API_BASE = "https://www.sankavollerei.web.id";

export async function getApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API merespons dengan status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function cleanTitle(value?: string): string {
  if (!value) return "Tanpa judul";
  const parts = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/\t{2,}| {4,}/);
  return (parts[0] || value).trim();
}
