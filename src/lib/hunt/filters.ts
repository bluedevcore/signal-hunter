import { AGENCY, BIG, HARD_TITLE, PHYSICAL, PRODUCTION, PUBLIC, SCAM, SENIOR_TITLE, SETTINGS, TITLE_STEMS } from "./config";

export type FilterInput = { title: string; company: string; snippet?: string; salaryMax: number | null; salaryMin: number | null; openingsAtEmployer: number };

/** Returns null when the job is kept, otherwise the reason it was dropped. */
export function noiseFilter(j: FilterInput): string | null {
  const t = j.title;
  const c = j.company || "";
  if (AGENCY.test(c)) return "Recruitment agency";
  if (PUBLIC.test(c)) return "Public sector or charity";
  if (BIG.test(c)) return "Big brand or group";
  if (SCAM.test(`${t} ${j.snippet || ""}`)) return "Looks like a scam";
  if (j.openingsAtEmployer > SETTINGS.maxOpeningsPerEmployer) return `Employer with ${SETTINGS.maxOpeningsPerEmployer}+ openings`;
  if (!TITLE_STEMS.test(t)) return "Not a desk-role title";
  if (HARD_TITLE.test(t)) return "Hands-on, technical or executive title";
  if (SENIOR_TITLE.test(t) && !PRODUCTION.test(t)) return "Manager / senior / lead title";
  const sal = Math.max(j.salaryMax || 0, j.salaryMin || 0);
  if (sal && (sal > SETTINGS.salaryMax || sal < SETTINGS.salaryMin)) return "Salary outside range";
  return null;
}

/** Counts physical / in-person signals in the full ad. 4+ means a hands-on role. */
export function physicalScore(text: string): number {
  return (text.match(PHYSICAL) || []).length;
}
