import { after } from "next/server";

/** After the response is sent, kick off the next tick so a hunt keeps running without anyone watching. */
export function chainNextTick(stillRunning: boolean) {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const secret = process.env.CRON_SECRET;
  if (!stillRunning || !host || !secret) return;
  after(async () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000); // only need the request to land, not to wait for it
    try {
      await fetch(`https://${host}/api/hunt/tick?chain=1`, { headers: { authorization: `Bearer ${secret}` }, signal: ctrl.signal });
    } catch {
      /* aborted on purpose */
    }
  });
}
