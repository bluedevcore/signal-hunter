// Shown instantly while a page's data loads, so clicks feel immediate.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-11 rounded-[10px] bg-white/70 border border-line" style={{ maxWidth: 520 }} />
      <div className="h-3 w-48 rounded bg-line" />
      <div className="h-[92px] rounded-xl bg-white/70 border border-line" />
      <div className="flex gap-2">{[120, 140, 130, 150, 110].map((w, i) => <div key={i} className="h-9 rounded-full bg-white/70 border border-line" style={{ width: w }} />)}</div>
      <div className="rounded-[14px] bg-white/70 border border-line">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center px-6 py-4 border-b border-line-soft">
            <div className="h-3 w-6 rounded bg-line" />
            <div className="flex-1 flex flex-col gap-2"><div className="h-3.5 w-2/3 rounded bg-line" /><div className="h-3 w-1/2 rounded bg-line-soft" /></div>
            <div className="h-3 w-20 rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
