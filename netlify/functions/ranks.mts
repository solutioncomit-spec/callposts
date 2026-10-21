import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { payFor, creditHeaders, clean, whoAmI } from "../lib/access.mts";
import { rankStore, checkRank, cleanTarget, serpEnabled, ownerPrefix, RANK_COST, MAX_TRACKERS, KEEP_HISTORY, type Tracker } from "../lib/serp.mts";

// Rank tracker: where a site ranks on Google for a keyword, searched from a US city.
//   GET    /api/ranks                         → my trackers (latest check + position history)
//   POST   /api/ranks { target, keyword, location, weekly }  → add a tracker and check it now (1 credit)
//   POST   /api/ranks { action: "check", id }  → check again now (1 credit)
//   PATCH  /api/ranks { id, weekly }           → turn weekly checks on or off
//   DELETE /api/ranks?id=...
const view = (t: Tracker) => {
  const last = t.history[0] || null, prev = t.history[1] || null;
  return {
    id: t.id, target: t.target, keyword: t.keyword, location: t.location, weekly: t.weekly, paused: t.paused || null, created: t.created, lastAt: t.lastAt || null,
    pos: last ? last.pos : null, depth: last?.depth || 30, url: last?.url || null, change: last && prev && last.pos && prev.pos ? prev.pos - last.pos : null,
    top: last?.top || [], series: t.history.slice(0, 26).map((h) => ({ at: h.at, pos: h.pos })).reverse(),
  };
};

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to track rankings.", needLogin: true }, { status: 401 });
  const prefix = ownerPrefix(owner);
  const store = rankStore();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix });
    const items = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Tracker | null>))).filter(Boolean) as Tracker[];
    items.sort((a, b) => b.created.localeCompare(a.created));
    return Response.json({ enabled: serpEnabled(), cost: RANK_COST, max: MAX_TRACKERS, trackers: items.map(view) }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "DELETE") {
    const id = clean(url.searchParams.get("id"), 60);
    await store.delete(`${prefix}${id}`);
    return Response.json({ ok: true });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  if (req.method === "PATCH") {
    const key = `${prefix}${clean(body.id, 60)}`;
    const t = (await store.get(key, { type: "json" })) as Tracker | null;
    if (!t) return Response.json({ error: "Tracker not found." }, { status: 404 });
    t.weekly = !!body.weekly; if (t.weekly) delete t.paused;
    await store.setJSON(key, t);
    return Response.json({ ok: true, tracker: view(t) });
  }
  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });
  if (!serpEnabled()) return Response.json({ error: "Rank tracking is being switched on. Try again soon." }, { status: 503 });

  let t: Tracker | null = null, key = "";
  if (body.action === "check") {
    key = `${prefix}${clean(body.id, 60)}`;
    t = (await store.get(key, { type: "json" })) as Tracker | null;
    if (!t) return Response.json({ error: "Tracker not found." }, { status: 404 });
  } else {
    const target = cleanTarget(clean(body.target, 200));
    const keyword = clean(body.keyword, 120).replace(/\s+/g, " ");
    const location = clean(body.location, 80);
    if (!target) return Response.json({ error: "Enter the site to track, like example.com or callposts.com/s/your-site." }, { status: 400 });
    if (keyword.length < 3) return Response.json({ error: "Enter the search phrase, like “water heater repair lakewood co”." }, { status: 400 });
    if (!/^[^,]{2,},\s*[A-Za-z]{2,}/.test(location)) return Response.json({ error: "Enter the city searchers are in, like “Lakewood, CO”." }, { status: 400 });
    const { blobs } = await store.list({ prefix });
    if (blobs.length >= MAX_TRACKERS) return Response.json({ error: `You can track up to ${MAX_TRACKERS} keywords. Delete one to add another.` }, { status: 400 });
    const user = owner.startsWith("user:") ? await getUser() : null;
    const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`;
    key = `${prefix}${id}`;
    t = { id, owner, email: user?.email || "", target, keyword, location, weekly: body.weekly !== false, created: new Date().toISOString(), history: [] };
  }

  const payer = await payFor(req, RANK_COST, `rank check: ${t.keyword}`);
  if (!payer.ok) return payer.res;
  try {
    const c = await checkRank(t.target, t.keyword, t.location);
    t.history = [c, ...t.history].slice(0, KEEP_HISTORY);
    t.lastAt = c.at; delete t.paused;
    await store.setJSON(key, t);
    console.log(`rank ${t.target} "${t.keyword}" ${t.location} → ${c.pos ?? "not in top " + c.depth}`);
    return Response.json({ ok: true, tracker: view(t), credits: payer.credits }, { headers: creditHeaders(payer) });
  } catch (e) {
    console.error("rank check failed", e);
    await payer.refund();
    return Response.json({ error: "Couldn't get Google results right now. Your credit was returned; try again in a minute." }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/ranks",
  method: ["GET", "POST", "PATCH", "DELETE"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
