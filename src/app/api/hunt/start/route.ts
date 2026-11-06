import { NextResponse } from "next/server";
import { startHunt, tick } from "@/lib/hunt/engine";
import { chainNextTick } from "@/lib/hunt/chain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Weekly Vercel Cron entry point (Mondays 06:00 UTC). */
export async function GET() {
  await startHunt("cron");
  const { run, message } = await tick(45_000);
  chainNextTick(run?.status === "running");
  return NextResponse.json({ message, run: run && { id: run.id, phase: run.phase, status: run.status } });
}
