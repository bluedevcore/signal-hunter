// Phone + website from Google Maps listings via Apify's compass/crawler-google-places actor.

const ACTOR = "compass~crawler-google-places";

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set");
  return t;
}

export async function startPlacesRun(queries: string[]): Promise<{ runId: string; datasetId: string }> {
  const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: queries,
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      countryCode: "gb",
      skipClosedPlaces: true,
      scrapePlaceDetailPage: false,
    }),
  });
  if (!res.ok) throw new Error(`Apify start ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { data: { id: string; defaultDatasetId: string } };
  return { runId: j.data.id, datasetId: j.data.defaultDatasetId };
}

export async function runStatus(runId: string): Promise<string> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token()}`);
  if (!res.ok) throw new Error(`Apify status ${res.status}`);
  return ((await res.json()) as { data: { status: string } }).data.status;
}

export type Place = { searchString?: string; title?: string; phone?: string; phoneUnformatted?: string; website?: string; address?: string };

export async function datasetItems(datasetId: string): Promise<Place[]> {
  const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${token()}`);
  if (!res.ok) throw new Error(`Apify dataset ${res.status}`);
  return res.json();
}

export function domainOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
