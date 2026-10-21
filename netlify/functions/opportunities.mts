import type { Config } from "@netlify/functions";
import { payFor, creditHeaders, clean } from "../lib/access.mts";
import { page1, serpEnabled } from "../lib/serp.mts";
import CITIES from "../lib/us-cities.mts";

// Opportunity Finder: reads Google page 1 for "<service> <city>" across several mid-size cities in a state and
// scores how crowded each one looks. A rough guide to where a new site has a better chance, not a forecast.
//   GET  /api/opportunities?state=CO           → candidate cities for a state
//   POST /api/opportunities { service, state, cities?: string[], order?: "large"|"small" }  (2 credits, up to 10 cities)
const COST = 2;
const MAX = 10;
const DIRECTORIES = ["yelp.com", "angi.com", "angieslist.com", "homeadvisor.com", "thumbtack.com", "bbb.org", "yellowpages.com", "houzz.com", "nextdoor.com", "porch.com",
  "facebook.com", "mapquest.com", "homeguide.com", "networx.com", "bark.com", "expertise.com", "threebestrated.com", "superpages.com", "manta.com", "chamberofcommerce.com",
  "buildzoom.com", "fixr.com", "modernize.com", "reddit.com", "youtube.com", "instagram.com", "linkedin.com", "craigslist.org", "groupon.com", "local.com", "citysearch.com",
  "birdeye.com", "trustpilot.com", "angi.com", "homeyou.com", "improvenet.com", "inspectorlink.com", "nextdoor.co", "zillow.com", "wikipedia.org", "google.com", "apple.com"];
type CityRow = [string, number, number, number];
const STATE_CITIES = CITIES as Record<string, CityRow[]>;
const isDir = (d: string) => DIRECTORIES.some((x) => d === x || d.endsWith("." + x));

function score(organic: { title: string; domain: string; link: string }[], town: string, service: string) {
  const t = town.toLowerCase(), words = service.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  let dirs = 0, local = 0, weak = 0;
  for (const h of organic.slice(0, 10)) {
    if (isDir(h.domain)) { dirs++; continue; }
    const title = h.title.toLowerCase();
    const hasCity = title.includes(t), hasSvc = words.some((w) => title.includes(w));
    if (hasCity && hasSvc) local++; else weak++;
  }
  // More directories and loosely matched pages = easier to break in; many exact local pages = harder.
  const s = Math.max(5, Math.min(95, Math.round(45 + dirs * 6 + weak * 3 - local * 6)));
  return { score: s, dirs, local, weak, label: s >= 65 ? "Easier" : s >= 45 ? "Medium" : "Harder" };
}

export default async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const st = clean(url.searchParams.get("state"), 2).toUpperCase();
    const list = STATE_CITIES[st] || [];
    return Response.json({ enabled: serpEnabled(), cost: COST, max: MAX, states: Object.keys(STATE_CITIES).sort(), cities: list.map(([n, p]) => ({ name: n, pop: p })) }, { headers: { "cache-control": "public, max-age=3600" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Use GET or POST." }, { status: 405 });
  if (!serpEnabled()) return Response.json({ error: "The Opportunity Finder is being switched on. Try again soon." }, { status: 503 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  const service = clean(body.service, 80);
  const st = clean(body.state, 2).toUpperCase();
  if (service.length < 3) return Response.json({ error: "Enter a service, like Water Heater Repair." }, { status: 400 });
  const all = STATE_CITIES[st];
  if (!all) return Response.json({ error: "Choose a US state." }, { status: 400 });
  let picks: CityRow[];
  const asked = Array.isArray(body.cities) ? (body.cities as unknown[]).map((c) => clean(c, 60).toLowerCase()).filter(Boolean) : [];
  if (asked.length) picks = all.filter((c) => asked.includes(c[0].toLowerCase())).slice(0, MAX);
  else picks = (body.order === "small" ? [...all].reverse() : all).slice(0, MAX);
  if (!picks.length) return Response.json({ error: "None of those cities are in our list for that state." }, { status: 400 });

  const payer = await payFor(req, COST, `opportunity scan: ${service}, ${st}`);
  if (!payer.ok) return payer.res;
  const results = await Promise.all(picks.map(async ([name, pop, lat, lng]) => {
    const city = `${name}, ${st}`;
    try {
      const { organic, places } = await page1(`${service} ${name} ${st}`, city);
      const s = score(organic, name, service);
      const reviews = places.reduce((a, p) => a + p.reviews, 0);
      return { city, name, pop, lat, lng, ...s, mapPack: places.length, mapReviews: reviews, top: organic.slice(0, 5).map((h) => ({ domain: h.domain, title: h.title, dir: isDir(h.domain) })) };
    } catch (e) {
      console.error("scan city failed", city, String(e).slice(0, 120));
      return { city, name, pop, lat, lng, error: true };
    }
  }));
  const ok = results.filter((r: any) => !r.error);
  if (!ok.length) { await payer.refund(); return Response.json({ error: "Couldn't read Google results right now. Your credits were returned." }, { status: 502 }); }
  ok.sort((a: any, b: any) => b.score - a.score);
  console.log(`opportunity scan ${service} ${st}: ${ok.length} cities`);
  return Response.json({ ok: true, service, state: st, results: [...ok, ...results.filter((r: any) => r.error)], credits: payer.credits }, { headers: creditHeaders(payer) });
};

export const config: Config = {
  path: "/api/opportunities",
  method: ["GET", "POST"],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
