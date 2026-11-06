import { askClaudeJson, costPence } from "@/lib/claude";
import type { DutyCoverage } from "@/db/schema";

export type Diagnosis = {
  responsibilities: string[];
  duty_coverage: DutyCoverage[];
  desk_fit: "strong" | "partial" | "poor";
  ease_of_build: number;
  replace_score: number;
  problem: string;
  evidence: string;
  solution: string;
  systems: string[];
  call_opener: string;
};

const SCHEMA = {
  type: "object",
  required: ["responsibilities", "duty_coverage", "desk_fit", "ease_of_build", "replace_score", "problem", "evidence", "solution", "systems", "call_opener"],
  properties: {
    responsibilities: { type: "array", items: { type: "string" }, description: "5-15 single tasks the person will do day to day, close to the ad's wording. No company blurb, person spec or benefits." },
    duty_coverage: {
      type: "array",
      items: {
        type: "object", required: ["duty", "coverage", "how"],
        properties: { duty: { type: "string" }, coverage: { type: "string", enum: ["full", "partial", "none"] }, how: { type: "string", description: "A few words on what the tool does for this duty" } },
      },
      description: "One entry per responsibility, same order.",
    },
    desk_fit: { type: "string", enum: ["strong", "partial", "poor"], description: "strong = on a computer most of the day producing work; partial = mixed; poor = mostly people or physical" },
    ease_of_build: { type: "integer", minimum: 1, maximum: 5, description: "5: standalone, documents in -> text out. 4: one file or form in -> one spreadsheet or system out. 3: connects to their accounting / CRM / ops software. 2: several systems plus people in the loop. 1: unclear or mixed." },
    replace_score: { type: "integer", minimum: 0, maximum: 10, description: "How much of the role a tool could do outright, weighted by how much of the week each duty takes (full=1, partial=0.5). Be conservative: almost nothing is above 7." },
    problem: { type: "string", description: "One line on WHY they're hiring (growth, manual process, backlog, new system, nobody owns it). Not a list of duties." },
    evidence: { type: "string", description: "A short exact quote from the ad that shows the problem (under 30 words)." },
    solution: { type: "string", description: "2-3 sentences on what the AI tool does, built around the duties with full or partial coverage." },
    systems: { type: "array", items: { type: "string" }, description: "Software named in the ad" },
    call_opener: { type: "string", description: "One sentence Josh can say on the phone to the hiring manager or owner. He offers a service at a fraction of the salary; he is not applying for the job." },
  },
};

export async function diagnoseJob(input: { title: string; company: string; salary: string; location: string; parsedResponsibilities: string[]; requirements: string[]; text: string }) {
  if (process.env.HUNT_MOCK_CLAUDE === "1") return mock(input);
  const prompt = `You are screening UK job ads for Josh Bluemink, who builds AI tools for small businesses and sells them as a service at about a fifth of the salary of the role.

Diagnose this ad.

Role: ${input.title}
Company: ${input.company}
Location: ${input.location}
Salary: ${input.salary}

${input.parsedResponsibilities.length ? `Responsibilities parsed from the ad (tidy these: split combined items, drop intro text and fluff, keep the wording):\n- ${input.parsedResponsibilities.join("\n- ")}` : "No responsibilities section was found: extract the duties from the full ad."}

${input.requirements.length ? `Requirements parsed from the ad:\n- ${input.requirements.join("\n- ")}\n` : ""}
Full ad:
"""
${input.text.slice(0, 12000)}
"""`;
  const { data, usage } = await askClaudeJson<Diagnosis>(prompt, "record_diagnosis", SCHEMA);
  data.ease_of_build = Math.min(5, Math.max(1, Math.round(data.ease_of_build)));
  data.replace_score = Math.min(10, Math.max(0, Math.round(data.replace_score)));
  return { data, pence: costPence(usage) };
}

function mock(input: { title: string; parsedResponsibilities: string[]; text: string }) {
  const duties = input.parsedResponsibilities.length ? input.parsedResponsibilities : input.text.split("\n").filter((l) => l.length > 30).slice(0, 5);
  const data: Diagnosis = {
    responsibilities: duties,
    duty_coverage: duties.map((d, i) => ({ duty: d, coverage: i % 3 === 2 ? "none" : i % 2 ? "partial" : "full", how: "(mock)" })),
    desk_fit: /admin|accounts|bookkeep|data|bid|tender|analyst|paralegal|payroll|compliance/i.test(input.title) ? "strong" : "partial",
    ease_of_build: 3, replace_score: 5,
    problem: "(mock) Workload has grown beyond the current team.", evidence: duties[0] || "", solution: "(mock) Tool that drafts and checks the routine outputs.", systems: [],
    call_opener: "(mock) I saw you're hiring and I've built a tool for that work.",
  };
  return { data, pence: 0 };
}
