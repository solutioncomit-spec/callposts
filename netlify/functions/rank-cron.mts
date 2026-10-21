import type { Config } from "@netlify/functions";
import { rankStore, checkRank, chargeOwner, refundOwner, serpEnabled, KEEP_HISTORY, type Tracker } from "../lib/serp.mts";

// Hourly: re-check trackers with weekly checks on whose last check is 7+ days old, a few per run
// (scheduled functions have a short time limit). Each check costs the owner 1 credit; if they're out
// of credits, the tracker pauses until they turn weekly checks back on.
const WEEK = 7 * 24 * 3600 * 1000;
const PER_RUN = 6;

export default async () => {
  if (!serpEnabled()) return;
  const store = rankStore();
  const { blobs } = await store.list({ prefix: "o/" });
  const due: { key: string; t: Tracker }[] = [];
  for (const b of blobs) {
    const t = (await store.get(b.key, { type: "json" })) as Tracker | null;
    if (t && t.weekly && !t.paused && (!t.lastAt || Date.now() - Date.parse(t.lastAt) >= WEEK)) due.push({ key: b.key, t });
  }
  due.sort((a, b) => String(a.t.lastAt).localeCompare(String(b.t.lastAt)));
  for (const { key, t } of due.slice(0, PER_RUN)) {
    if (!(await chargeOwner(t))) {
      t.weekly = false; t.paused = "Out of credits: weekly checks paused. Top up and turn them back on.";
      await store.setJSON(key, t);
      continue;
    }
    try {
      const c = await checkRank(t.target, t.keyword, t.location);
      t.history = [c, ...t.history].slice(0, KEEP_HISTORY);
      t.lastAt = c.at;
      await store.setJSON(key, t);
      console.log(`weekly rank ${t.target} "${t.keyword}" → ${c.pos ?? "-"}`);
    } catch (e) {
      console.error("weekly rank check failed", e);
      await refundOwner(t);
    }
  }
  console.log(`rank-cron: ${due.length} due, ran ${Math.min(due.length, PER_RUN)}`);
};

export const config: Config = { schedule: "@hourly" };
