import { normaliseName } from "@/lib/util";

const BASE = "https://api.company-information.service.gov.uk";

function auth() {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY is not set");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(BASE + path, { headers: { Authorization: auth() } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Companies House ${res.status}`);
  return res.json() as Promise<T>;
}

type SearchItem = { title: string; company_number: string; company_status: string; address_snippet?: string; address?: { locality?: string; postal_code?: string } };

function similarity(a: string, b: string) {
  const A = new Set(normaliseName(a).split(" ").filter(Boolean));
  const B = new Set(normaliseName(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.max(A.size, B.size);
}

const SMALL = /micro|small|total-exemption|unaudited-abridged|dormant|audit-exemption-subsidiary|filing-exemption/;

export type CompanyCheck = {
  number: string; status: string; accountsType: string | null; sizeBand: string; directors: string[]; address: string | null; isGroup: boolean; confidence: number;
};

/** Best active match for an employer name, using the job's location to break ties. Null when nothing is a confident match. */
export async function checkCompany(name: string, location: string | null): Promise<CompanyCheck | null> {
  const q = encodeURIComponent(name.replace(/\b(ltd|limited)\b\.?/gi, "").trim());
  const s = await get<{ items: SearchItem[] }>(`/search/companies?q=${q}&items_per_page=10`);
  const loc = (location || "").toLowerCase();
  const ranked = (s?.items || [])
    .filter((i) => i.company_status === "active")
    .map((i) => {
      let score = similarity(name, i.title);
      const addr = (i.address_snippet || "").toLowerCase();
      if (loc && (addr.includes(loc) || (i.address?.postal_code || "").toLowerCase().replace(/\s/g, "").startsWith(loc.replace(/\s/g, "").slice(0, 3)))) score += 0.15;
      return { i, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 0.6) return null;
  const n = best.i.company_number;
  const profile = await get<{ accounts?: { last_accounts?: { type?: string } }; registered_office_address?: Record<string, string>; has_super_secure_pscs?: boolean }>(`/company/${n}`);
  const officers = await get<{ items: { name: string; officer_role: string; resigned_on?: string }[] }>(`/company/${n}/officers?items_per_page=35`);
  const pscs = await get<{ items: { kind: string; ceased_on?: string }[] }>(`/company/${n}/persons-with-significant-control`);
  const rawType = profile?.accounts?.last_accounts?.type;
  const accountsType = rawType && rawType !== "null" ? rawType : null;
  const isGroup = (pscs?.items || []).some((p) => !p.ceased_on && p.kind.startsWith("corporate-entity"));
  const sizeBand = !accountsType ? "unknown" : SMALL.test(accountsType) ? "SMB" : accountsType === "medium" ? "Mid-size" : /group|full/.test(accountsType) ? "Large/group" : "unknown";
  const directors = (officers?.items || [])
    .filter((o) => !o.resigned_on && o.officer_role === "director")
    .map((o) => o.name.split(", ").reverse().join(" ").replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()));
  const a = profile?.registered_office_address;
  return {
    number: n, status: best.i.company_status, accountsType, sizeBand, directors, isGroup, confidence: best.score,
    address: a ? [a.address_line_1, a.locality, a.postal_code].filter(Boolean).join(", ") : null,
  };
}
