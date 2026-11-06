export default function Loading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true" aria-label="Loading lead">
      <div className="flex justify-between"><div className="h-4 w-56 rounded bg-line" /><div className="h-10 w-80 rounded-[10px] bg-white/70 border border-line" /></div>
      <div className="h-[190px] rounded-[14px] bg-white/70 border border-line" />
      <div className="flex gap-6 flex-wrap">
        <div className="flex flex-col gap-6" style={{ flex: "999 1 560px" }}>
          <div className="h-[420px] rounded-[14px] bg-white/70 border border-line" />
          <div className="h-[200px] rounded-[14px] bg-white/70 border border-line" />
        </div>
        <div className="flex flex-col gap-6" style={{ flex: "1 1 340px" }}>
          <div className="h-[220px] rounded-[14px] bg-white/70 border border-line" />
          <div className="h-[160px] rounded-[14px] bg-white/70 border border-line" />
        </div>
      </div>
    </div>
  );
}
