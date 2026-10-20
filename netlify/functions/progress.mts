import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { whoAmI } from "../lib/access.mts";

// Course progress per account (or access code): which lessons are done.
//   GET  /api/progress            → { done: string[] }
//   POST /api/progress { done }   → saves the list
const store = () => getStore({ name: "progress", consistency: "strong" });

export default async (req: Request) => {
  const who = await whoAmI(req);
  if (!who) return Response.json({ done: [], loggedIn: false }, { headers: { "cache-control": "no-store" } });
  const key = `p/${who}`;
  if (req.method === "POST") {
    let body: any;
    try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
    const done = (Array.isArray(body?.done) ? body.done : []).map((x: unknown) => String(x).slice(0, 20)).filter((x: string) => /^[a-z0-9-]+$/.test(x)).slice(0, 50);
    await store().setJSON(key, { done: [...new Set(done)], at: new Date().toISOString() });
    return Response.json({ ok: true, done });
  }
  const got = (await store().get(key, { type: "json" })) as { done?: string[] } | null;
  return Response.json({ done: got?.done || [], loggedIn: true }, { headers: { "cache-control": "no-store" } });
};

export const config: Config = { path: "/api/progress", method: ["GET", "POST"], rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] } };
