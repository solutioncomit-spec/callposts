import { ANGLE_NAMES } from "../lib/angles.mts";
import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { payFor, creditHeaders, clean } from "../lib/access.mts";

const COST = 1;

// Picks the next markets to post in, from the payout list the app sends,
// weighing payout, the season, and what the publisher already posted.
const MODEL = "claude-sonnet-5-5";

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  const markets = (Array.isArray(body.markets) ? body.markets : [])
    .slice(0, 200)
    .map((m: unknown) => (Array.isArray(m) ? [clean(m[0], 60), clean(m[1], 60), Number(m[2]) || 0] : null))
    .filter((m): m is [string, string, number] => !!m && !!m[0] && !!m[1]);
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(0, 40)
    .map((h: any) => `${clean(h?.service, 60)} | ${clean(h?.city, 60)} | ${clean(h?.date, 12)}${h?.note ? ` | result note: ${clean(h.note, 140)}` : ""}`)
    .filter((s: string) => s.replace(/[\s|]/g, ""));
  const notes = clean(body.notes, 400);
  if (!markets.length) return Response.json({ error: "No markets to choose from." }, { status: 400 });

  if (!Netlify.env.get("ANTHROPIC_BASE_URL") && !Netlify.env.get("ANTHROPIC_API_KEY")) {
    return Response.json({ error: "The AI service isn't active on this site yet." }, { status: 503 });
  }

  const payer = await payFor(req, COST, "AI market picks");
  if (!payer.ok) return payer.res;

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You help a Facebook Marketplace pay-per-call publisher decide where to post next. Today is ${today}.

Available markets (service | city | reported top payout per qualified call in USD):
${markets.map((m) => `${m[0]} | ${m[1]} | $${m[2]}`).join("\n")}

What they posted recently (service | city | date | their own note on results, if any), newest first:
${history.length ? history.join("\n") : "(nothing yet)"}

Their notes: ${notes || "(none)"}

Pick the 5 best markets to post in next. Weigh: payout; seasonal demand for this time of year in that city's climate (e.g. heating and water heaters ahead of winter in cold states, AC in hot states); spreading across services and cities so they are not posting the same thing again; their result notes (lean toward services and cities they say brought calls, away from ones they say did nothing); and their notes. Prefer markets they have not posted in during the last 7 days unless it is clearly the best payout. Only choose from the list above, copying service and city exactly. Do not invent data you do not have (no call volumes, competition counts or conversion rates). Keep each reason to one plain sentence. Suggest a listing angle from: ${ANGLE_NAMES.map((n) => `"${n}"`).join(", ")}. Never use the word "free".

Reply with only a JSON array of 5 items: {"service": string, "city": string, "payout": number, "angle": string, "why": string}`;

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1500, messages: [{ role: "user", content: prompt }] });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const a = text.indexOf("["), z = text.lastIndexOf("]");
    const picks = JSON.parse(text.slice(a, z + 1));
    const valid = new Set(markets.map((m) => `${m[0]}|${m[1]}`));
    const out = (Array.isArray(picks) ? picks : [])
      .filter((p: any) => valid.has(`${p?.service}|${p?.city}`))
      .slice(0, 5)
      .map((p: any) => ({
        service: p.service, city: p.city,
        payout: markets.find((m) => m[0] === p.service && m[1] === p.city)?.[2] ?? null,
        angle: clean(p.angle, 40), why: clean(p.why, 240).replace(/\bfree\b\s*/gi, ""),
      }));
    if (!out.length) throw new Error("no valid picks");
    console.log(`suggest ok who=${payer.label} picks=${out.length}`);
    return Response.json({ picks: out }, { headers: { "cache-control": "no-store", ...creditHeaders(payer) } });
  } catch (e) {
    console.error("suggest failed", e);
    await payer.refund();
    return Response.json({ error: "Couldn't get suggestions right now. Try again in a minute." }, { status: 502 });
  }
};

export const config: Config = {
  path: "/api/suggest",
  method: "POST",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
