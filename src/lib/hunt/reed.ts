const BASE = "https://www.reed.co.uk/api/1.0";

function auth() {
  const key = process.env.REED_API_KEY;
  if (!key) throw new Error("REED_API_KEY is not set");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

export type ReedSearchItem = {
  jobId: number; employerName: string; jobTitle: string; locationName: string;
  minimumSalary: number | null; maximumSalary: number | null; date: string; expirationDate: string; jobUrl: string; jobDescription: string;
};

export async function reedSearch(keywords: string, skip: number, take = 100): Promise<{ items: ReedSearchItem[]; total: number }> {
  const u = new URL(BASE + "/search");
  u.searchParams.set("keywords", keywords);
  u.searchParams.set("postedByDirectEmployer", "true");
  u.searchParams.set("resultsToTake", String(take));
  u.searchParams.set("resultsToSkip", String(skip));
  const res = await fetch(u, { headers: { Authorization: auth() } });
  if (!res.ok) throw new Error(`Reed search ${res.status}`);
  const j = (await res.json()) as { results: ReedSearchItem[]; totalResults: number };
  return { items: j.results || [], total: j.totalResults || 0 };
}

export async function reedJob(id: string): Promise<{ jobDescription: string; expirationDate?: string; jobUrl?: string; contractType?: string } | null> {
  const res = await fetch(`${BASE}/jobs/${id}`, { headers: { Authorization: auth() } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Reed job ${res.status}`);
  return res.json();
}

/** Reed dates are dd/mm/yyyy */
export function reedDate(s: string | undefined | null): string | null {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
