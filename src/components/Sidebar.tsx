"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar({ leads, today }: { leads: number | null; today: number | null }) {
  const path = usePathname();
  const items: { label: string; href: string; count?: number | null; accent?: boolean }[] = [
    { label: "Leads", href: "/", count: leads },
    { label: "Today", href: "/today", count: today, accent: true },
    { label: "Pipeline", href: "/pipeline" },
    { label: "Hunts", href: "/hunts" },
    { label: "Builds", href: "/builds" },
    { label: "Settings", href: "/settings" },
  ];
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/leads") : path.startsWith(href));
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 bg-side border-r border-line px-4 py-6 box-border" style={{ flex: "0 0 232px" }}>
      <Link href="/" className="flex items-center gap-2.5 px-2.5 pb-5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B4321F" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
        </svg>
        <span className="font-bold text-base tracking-tight">Signal Hunter</span>
      </Link>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active(it.href) ? "page" : undefined}
          className={`flex justify-between items-center px-3 py-2.5 rounded-lg text-sm ${active(it.href) ? "bg-white border border-line font-semibold" : "text-ink-2 border border-transparent hover:bg-white/60"}`}
        >
          {it.label}
          {it.count != null && <span className="font-mono text-xs" style={{ color: it.accent && it.count > 0 ? "#B4321F" : "#5F5C55" }}>{it.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
