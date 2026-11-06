import { NextResponse } from "next/server";
import { tick } from "@/lib/hunt/engine";
import { chainNextTick } from "@/lib/hunt/chain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { run, message } = await tick(45_000);
  chainNextTick(run?.status === "running" && !message.startsWith("Waiting for ANTHROPIC"));
  return NextResponse.json({ message, run: run && { id: run.id, kind: run.kind, phase: run.phase, status: run.status, counts: run.counts, error: run.error } });
}
