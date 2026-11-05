export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|plc|llp|uk|\(uk\)|co)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function reedIdFromUrl(url: string | undefined): string {
  const m = (url || "").match(/\/(\d+)(?:\?|$|\/)/);
  return m ? m[1] : (url || "").trim();
}

/** "23/11/2026" -> "2026-11-23" */
export function ukDate(s: string | undefined): string | null {
  const m = (s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const ms = new Date(d + "T00:00:00Z").getTime() - new Date(today() + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

export function shortDate(d: string | Date | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

export function dayLabel(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
