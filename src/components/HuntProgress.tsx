"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RunInfo = { id: number; kind: string; phase: string | null; status: string; counts: Record<string, number> | null; error: string | null };
const PHASES = ["scan", "filter", "describe", "diagnose", "company", "enrich", "leads"];
const LABEL: Record<string, string> = { scan: "Scanning Reed", filter: "Filtering", describe: "Reading full ads", diagnose: "Claude diagnosis", company: "Companies House", enrich: "Phone numbers", leads: "Creating leads" };

/** Keeps the hunt moving while this page is open (each call does ~45s of work) and shows progress. */
export function HuntProgress({ initial }: { initial: RunInfo }) {
  const [run, setRun] = useState<RunInfo>(initial);
  const [msg, setMsg] = useState("");
  const alive = useRef(true);
  const router = useRouter();
  useEffect(() => {
    alive.current = true;
    (async () => {
      while (alive.current) {
        try {
          const r = await fetch("/api/hunt/tick", { cache: "no-store" });
          const j = (await r.json()) as { message: string; run: RunInfo | null };
          if (j.run) setRun(j.run);
          setMsg(j.message);
          if (!j.run || j.run.status !== "running") { router.refresh(); break; }
          if (j.message.startsWith("Waiting") || j.message.startsWith("Another")) await new Promise((res) => setTimeout(res, 10000));
        } catch {
          await new Promise((res) => setTimeout(res, 5000));
        }
      }
    })();
    return () => { alive.current = false; };
  }, [router]);
  const c = run.counts || {};
  const phases = run.kind === "backfill" ? ["describe", "diagnose"] : PHASES;
  const at = phases.indexOf(run.phase || "");
  return (
    <section className="card p-6 flex flex-col gap-4" aria-live="polite">
      <div className="flex justify-between items-baseline flex-wrap gap-2">
        <h2 className="m-0 text-xl font-bold">{run.kind === "backfill" ? "Backfill running" : "Hunt running"} · {LABEL[run.phase || ""] || run.phase}</h2>
        <span className="text-[13px] text-mute">Keep this page open to speed it up. It also carries on by itself.</span>
      </div>
      <div className="flex gap-1.5">
        {phases.map((p, i) => (
          <span key={p} className="flex-1 flex flex-col gap-1.5">
            <span className="h-1.5 rounded-sm" style={{ background: i < at ? "#1B1A17" : i === at ? "#B4321F" : "#E4E1DA" }} />
            <span className="text-[11px] text-mute">{LABEL[p]}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-mono">
        {Object.entries(c).filter(([k]) => !k.startsWith("drop:") && k !== "errors" && k !== "seen").map(([k, v]) => <span key={k}>{k.replace("_", " ")}: <strong>{k === "cost_pence" ? `£${(v / 100).toFixed(2)}` : v}</strong></span>)}
      </div>
      {(run.error || msg.startsWith("Error") || msg.startsWith("Waiting")) && <p className="m-0 text-sm text-accent">{run.error || msg}</p>}
    </section>
  );
}
