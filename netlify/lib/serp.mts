// Google rankings via the Serper API (https://serper.dev). Needs SERPER_API_KEY.
// One rank check reads up to 3 result pages (top 30), stopping as soon as the tracked site is found.
import { getStore } from "@netlify/blobs";
import { changeCredits } from "./credits.mts";

export const RANK_COST = 1;
export const MAX_DEPTH_PAGES = 3;
export const MAX_TRACKERS = 25;
export const rankStore = () => getStore({ name: "ranks", consistency: "strong" });

export type Hit = { pos: number; title: string; link: string; domain: string };
export type Check = { at: string; pos: number | null; url: string | null; top: Hit[]; depth: number };
export type Tracker = {
  id: string; owner: string; email: string; target: string; keyword: string; location: string;
  weekly: boolean; paused?: string; created: string; lastAt?: string; history: Check[];
  match?: string; // extra URL prefixes that count as this site (a hosted CallPosts site's /p/ pages), "|"-separated
};

export const serpEnabled = () => !!Netlify.env.get("SERPER_API_KEY");

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// "Lakewood, CO" → "Lakewood, Colorado, United States" (Google's location format).
export function googleLocation(city: string): string {
  const [town, st] = city.split(",").map((s) => s.trim());
  if (!town) return "United States";
  const state = st ? STATES[st.toUpperCase()] || st : "";
  return [town, state, "United States"].filter(Boolean).join(", ");
}

// Normalise what the user tracks: a domain ("example.com") or a URL prefix ("callposts.com/s/my-site").
export function cleanTarget(v: string): string | null {
  let t = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,24}(\/[a-z0-9._~%\-\/]*)?$/.test(t)) return null;
  return t;
}
const hostOf = (link: string) => { try { return new URL(link).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
function matches(target: string, link: string): boolean {
  if (target.includes("|")) return target.split("|").some((t) => t && matches(t, link));
  let u: URL; try { u = new URL(link); } catch { return false; }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const [tHost, ...rest] = target.split("/");
  const tPath = rest.length ? "/" + rest.join("/") : "";
  if (host !== tHost && !host.endsWith("." + tHost)) return false;
  return !tPath || u.pathname.toLowerCase().startsWith(tPath);
}

async function serpPage(q: string, location: string, page: number): Promise<Hit[]> {
  const call = (withLoc: boolean) => fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": Netlify.env.get("SERPER_API_KEY") || "", "content-type": "application/json" },
    body: JSON.stringify({ q, gl: "us", hl: "en", num: 10, page, ...(withLoc ? { location } : {}) }),
  });
  let r = await call(true);
  // An unrecognised location string is rejected; fall back to the plain query (keywords usually include the city).
  if (r.status === 400) r = await call(false);
  if (!r.ok) throw new Error(`Search data ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j: any = await r.json();
  return (Array.isArray(j.organic) ? j.organic : []).map((o: any, i: number) => ({
    pos: (page - 1) * 10 + (Number(o.position) || i + 1), title: String(o.title || "").slice(0, 140), link: String(o.link || ""), domain: hostOf(String(o.link || "")),
  })).filter((h: Hit) => h.link);
}

export async function checkRank(target: string, keyword: string, location: string): Promise<Check> {
  const top: Hit[] = [];
  let found: Hit | null = null, depth = 0;
  for (let p = 1; p <= MAX_DEPTH_PAGES && !found; p++) {
    const hits = await serpPage(keyword, googleLocation(location), p);
    depth = p * 10;
    for (const h of hits) { top.push(h); if (!found && matches(target, h.link)) found = h; }
    if (hits.length < 8) break; // no more results
  }
  return { at: new Date().toISOString(), pos: found?.pos ?? null, url: found?.link ?? null, top: top.slice(0, 10), depth };
}

// Charge for a scheduled check. Access-code owners aren't charged; users need a credit.
export async function chargeOwner(t: Tracker): Promise<boolean> {
  if (t.owner.startsWith("code:")) return true;
  const id = t.owner.replace(/^user:/, "");
  const acc = await changeCredits(id, t.email, -RANK_COST, `weekly rank check: ${t.keyword}`);
  return !!acc;
}
export async function refundOwner(t: Tracker) {
  if (t.owner.startsWith("code:")) return;
  try { await changeCredits(t.owner.replace(/^user:/, ""), t.email, RANK_COST, `refund: weekly rank check: ${t.keyword}`); } catch (e) { console.error("rank refund failed", e); }
}

export const ownerPrefix = (owner: string) => `o/${owner.replace(/[^a-zA-Z0-9:_-]/g, "_")}/`;
export const KEEP_HISTORY = 52;

// Page 1 of Google for a query from a city, with the map pack. Used by the Opportunity Finder.
export async function page1(q: string, city: string): Promise<{ organic: Hit[]; places: { title: string; rating: number; reviews: number }[] }> {
  const call = (withLoc: boolean) => fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": Netlify.env.get("SERPER_API_KEY") || "", "content-type": "application/json" },
    body: JSON.stringify({ q, gl: "us", hl: "en", num: 10, ...(withLoc ? { location: googleLocation(city) } : {}) }),
  });
  let r = await call(true);
  if (r.status === 400) r = await call(false);
  if (!r.ok) throw new Error(`Search data ${r.status}`);
  const j: any = await r.json();
  const organic = (Array.isArray(j.organic) ? j.organic : []).map((o: any, i: number) => ({ pos: Number(o.position) || i + 1, title: String(o.title || "").slice(0, 140), link: String(o.link || ""), domain: hostOf(String(o.link || "")) })).filter((h: Hit) => h.link);
  const places = (Array.isArray(j.places) ? j.places : []).slice(0, 3).map((p: any) => ({ title: String(p.title || "").slice(0, 80), rating: Number(p.rating) || 0, reviews: Number(p.ratingCount || p.reviews || 0) || 0 }));
  return { organic, places };
}
