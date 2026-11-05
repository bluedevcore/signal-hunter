import type { ReactNode } from "react";

export const STAGE_STYLE: Record<string, [string, string]> = {
  New: ["#ECEAE4", "#3D3B36"],
  Researched: ["#F6EAD3", "#6B4100"],
  Contacted: ["#DFE8F5", "#1D4477"],
  Conversation: ["#ECE5F6", "#4A2F7A"],
  "Demo sent": ["#DDEFEF", "#1C5656"],
  Proposal: ["#F7E1DD", "#8A2414"],
  Won: ["#E3EFE2", "#1F5A2E"],
  Lost: ["#ECEAE4", "#5F5C55"],
  "Not now": ["#ECEAE4", "#5F5C55"],
};

export const STAGE_DOT: Record<string, string> = {
  New: "#A9A59C", Researched: "#C8932E", Contacted: "#3B6BB0", Conversation: "#7A5BB0",
  "Demo sent": "#2E8A8A", Proposal: "#B4321F", Won: "#2F7A3A", Lost: "#8A867D", "Not now": "#8A867D",
};

export function StagePill({ stage }: { stage: string }) {
  const [bg, fg] = STAGE_STYLE[stage] || STAGE_STYLE.New;
  return <span className="pill" style={{ background: bg, color: fg }}>{stage}</span>;
}

export function EaseBars({ ease, size = "md" }: { ease: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  const w = size === "sm" ? 10 : size === "lg" ? 14 : 12;
  const h = size === "sm" ? 5 : 6;
  const n = ease ?? 0;
  return (
    <span role="img" aria-label={`Ease of build ${n} out of 5`} title={`Ease of build ${n}/5`} style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: w, height: h, borderRadius: 2, background: i <= n ? "#1B1A17" : "#E4E1DA" }} />
      ))}
    </span>
  );
}

export function ReplaceBar({ replace, improve, height = 8, label = true }: { replace: number | null | undefined; improve?: number | null; height?: number; label?: boolean }) {
  const r = replace ?? 0;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span aria-hidden style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden", background: "#E4E1DA" }}>
        <span style={{ width: `${r * 10}%`, background: "#1B1A17" }} />
      </span>
      {label && (
        <span style={{ fontSize: 12, color: "#5F5C55" }}>
          <strong style={{ color: "#1B1A17" }}>{r}</strong> replace · {improve ?? 10 - r} improve
        </span>
      )}
    </span>
  );
}

const COV: Record<string, [string, string, string]> = {
  full: ["#E3EFE2", "#1F5A2E", "Full"],
  partial: ["#F6EAD3", "#6B4100", "Partial"],
  none: ["#ECEAE4", "#3D3B36", "None"],
};
export function CoveragePill({ coverage }: { coverage: string }) {
  const [bg, fg, label] = COV[coverage] || COV.none;
  return <span className="pill" style={{ background: bg, color: fg }}>{label}</span>;
}

export const DEMO_STATUS: Record<string, [string, string, string]> = {
  live: ["#E3EFE2", "#1F5A2E", "Live"],
  built: ["#DFE8F5", "#1D4477", "Built"],
  in_progress: ["#F6EAD3", "#6B4100", "In progress"],
  queued: ["#ECEAE4", "#3D3B36", "Queued"],
};
export function DemoPill({ status }: { status: string }) {
  const [bg, fg, label] = DEMO_STATUS[status] || DEMO_STATUS.queued;
  return <span className="pill" style={{ background: bg, color: fg }}>{label}</span>;
}

export function Section({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-7 flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap justify-between items-baseline gap-3">
        <h2 className="m-0 text-[22px] font-bold tracking-tight">{title}</h2>
        {aside && <span className="text-[13px] text-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function StatStrip({ cells }: { cells: { label: string; value: ReactNode; note?: string; pct?: number; accent?: boolean; dot?: string }[] }) {
  return (
    <section aria-label="Summary" className="card grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`, borderRadius: 12 }}>
      {cells.map((c, i) => (
        <div key={c.label} className="flex flex-col gap-2.5 min-w-0" style={{ padding: "14px 20px", borderLeft: i ? "1px solid #EEECE6" : undefined }}>
          <span className="label flex items-center gap-2">
            {c.dot && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: c.dot }} />}
            {c.label}
          </span>
          <span className="flex items-baseline gap-2.5 min-w-0">
            <span className="text-[28px] font-extrabold leading-none" style={{ letterSpacing: "-0.03em" }}>{c.value}</span>
            {c.note && <span className="text-[13px] text-mute truncate">{c.note}</span>}
          </span>
          {c.pct !== undefined && (
            <span aria-hidden className="flex h-1 rounded-sm overflow-hidden" style={{ background: "#EEECE6" }}>
              <span style={{ width: `${Math.max(2, c.pct)}%`, background: c.accent ? "#B4321F" : "#1B1A17", borderRadius: 2 }} />
            </span>
          )}
        </div>
      ))}
    </section>
  );
}
