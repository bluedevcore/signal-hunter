"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setStage } from "@/lib/actions";
import { EaseBars } from "./ui";

export type Card = { id: number; stage: string; company: string; role: string; salary: string; ease: number | null; next: string | null; due: boolean; tool: string | null };
type Col = { name: string; dot: string };

export function Board({ cols, cards, cap = 30 }: { cols: Col[]; cards: Card[]; cap?: number }) {
  const [, start] = useTransition();
  const [items, move] = useOptimistic(cards, (state, m: { id: number; stage: string }) => state.map((c) => (c.id === m.id ? { ...c, stage: m.stage } : c)));

  const drop = (stage: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!id) return;
    start(async () => {
      move({ id, stage });
      await setStage(id, stage);
    });
  };

  return (
    <div className="overflow-x-auto pb-1.5">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, 256px)` }}>
        {cols.map((c) => {
          const list = items.filter((x) => x.stage === c.name);
          return (
            <section key={c.name} aria-label={c.name} className="flex flex-col gap-2">
              <h2 className="m-0 px-1 pt-1 pb-0.5 flex justify-between items-center text-[13px] font-bold">
                <span className="flex items-center gap-2"><span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: c.dot }} />{c.name}</span>
                <span className="font-mono text-xs font-medium text-mute">{list.length}</span>
              </h2>
              <div onDragOver={(e) => e.preventDefault()} onDrop={drop(c.name)} className="bg-well rounded-xl p-2 flex flex-col gap-2" style={{ minHeight: 560 }}>
                {list.slice(0, cap).map((k) => (
                  <Link
                    key={k.id}
                    href={`/leads/${k.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(k.id))}
                    className="link-row bg-white border border-line rounded-[10px] px-3.5 py-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs text-mute">{k.company}</span>
                      <span className="row-title text-sm font-bold leading-snug">{k.role}</span>
                    </span>
                    <span className="flex justify-between items-center">
                      <span className="font-mono text-xs">{k.salary}</span>
                      <EaseBars ease={k.ease} size="sm" />
                    </span>
                    <span className="flex justify-between gap-2 items-center border-t border-line-soft pt-2 text-xs">
                      <span className="truncate" style={{ color: k.due ? "#B4321F" : "#5F5C55", fontWeight: k.due ? 600 : 400 }}>{k.next || "No next action"}</span>
                      <span className="font-mono text-[11px] text-mute whitespace-nowrap">{k.tool || ""}</span>
                    </span>
                  </Link>
                ))}
                {list.length > cap && <Link href={`/?stage=${encodeURIComponent(c.name)}&fit=all`} className="py-2.5 text-center text-[13px] font-semibold text-mute">+ {list.length - cap} more</Link>}
                {list.length === 0 && <div className="border border-dashed rounded-[10px] px-3 py-5 text-[13px] text-mute text-center" style={{ borderColor: "#CFCBC2" }}>{c.name === "Won" ? "First close lands here" : "Drag a card here"}</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
