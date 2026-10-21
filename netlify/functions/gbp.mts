import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { payFor, creditHeaders, clean, whoAmI } from "../lib/access.mts";
import { page1, serpEnabled } from "../lib/serp.mts";

// Google Business Profile toolkit for real local businesses (owners and the agencies that manage them).
//   GET    /api/gbp                          → saved businesses
//   PUT    /api/gbp { business }             → save or update a business (no credits)
//   DELETE /api/gbp?id=...
//   POST   /api/gbp { tool, businessId, input? }  → profile | posts | reviews | qa  (1 credit, AI)
//   POST   /api/gbp { tool: "compare", businessId } → the Google map pack for the business's category and city (1 credit)
// The writer only uses facts the owner gives; it never invents reviews, licences, awards, prices or offers.
const COST = 1;
const MODEL = "claude-sonnet-5-5";
const MAX_BIZ = 30;
const store = () => getStore({ name: "gbp", consistency: "strong" });

type Business = {
  id: string; name: string; category: string; city: string; area: string; phone: string; website: string;
  services: string[]; facts: string; tone: string; updated: string;
};

function cleanBiz(b: any, id: string): Business | null {
  const name = clean(b?.name, 100), category = clean(b?.category, 80), city = clean(b?.city, 80);
  if (!name || !category || !city) return null;
  return {
    id, name, category, city, area: clean(b?.area, 300), phone: clean(b?.phone, 30), website: clean(b?.website, 200),
    services: (Array.isArray(b?.services) ? b.services : String(b?.services || "").split(/\n|,/)).map((s: unknown) => clean(s, 80)).filter(Boolean).slice(0, 20),
    facts: clean(b?.facts, 1500), tone: clean(b?.tone, 40) || "friendly and professional", updated: new Date().toISOString(),
  };
}

const RULES = `Rules:
- Use only facts the owner gave in the business details. Never invent reviews, ratings, years in business, licences, insurance, certifications, awards, guarantees, prices, discounts or offers. If something would help but wasn't given, leave it out.
- Follow Google Business Profile content policies: no phone numbers or URLs inside descriptions or posts, no keyword stuffing, no ALL CAPS, no misleading claims, no references to competitors.
- Plain, natural American English in a ${"${tone}"} tone. Short sentences.`;

function prompt(tool: string, b: Business, input: string): { text: string; max: number } {
  const details = `Business details (from the owner):
Name: ${b.name}
Main category: ${b.category}
Based in: ${b.city}
Service area: ${b.area || "(not given)"}
Services: ${b.services.join("; ") || "(not given)"}
Facts the owner wants mentioned: ${b.facts || "(none)"}`;
  const rules = RULES.replace("${tone}", b.tone);
  if (tool === "profile") return { max: 4000, text: `${details}

Write Google Business Profile content for this business.
${rules}
Reply with only one JSON object, no code fences:
{"description": a business description of 600-740 characters (the limit is 750) that opens with what the business does and where, covers the main services and service area, and ends with an invitation to call or visit; no phone number or URL,
 "primaryCategory": the best matching Google Business Profile primary category name,
 "secondaryCategories": array of 2-5 additional Google category names that genuinely fit the listed services,
 "services": array of objects {"name": service name, "description": 150-280 characters describing it} for each listed service (or the obvious core services for the category if none were listed, max 8),
 "attributes": array of 3-6 profile attributes worth checking in the dashboard (e.g. "Online estimates", "Onsite services"), only ones the owner can confirm,
 "photoIdeas": array of 6 specific photo ideas for this business (team, vehicles, before/after, storefront)}` };
  if (tool === "posts") return { max: 5000, text: `${details}
${input ? `Topics or offers the owner asked for: ${input}` : ""}
Write 8 Google Business Profile update posts for the next two months for this business: a mix of seasonal tips, service spotlights, behind-the-scenes, and "how we work" posts. Only mention an offer if the owner gave one above.
${rules}
Reply with only a JSON array of 8 objects: {"title": short internal label, "text": 120-280 words of post text, no phone number or URL, "button": one of "Call now", "Learn more", "Book", "Get offer" (only if an owner-given offer), "photo": what photo to attach}` };
  if (tool === "reviews") return { max: 5000, text: `${details}

Customer reviews to reply to (separated by blank lines or "---"):
${input}

Write a reply to each review as the business owner. Thank the customer by first name if one appears; mention the specific job or detail they mentioned; keep it 40-110 words. For negative or mixed reviews: stay calm, apologise for the experience without admitting fault or liability, don't argue or share private details, and invite them to contact the business directly to make it right. Never offer refunds, discounts or compensation unless the owner said to.
${rules}
Reply with only a JSON array of objects: {"review": first 80 characters of the review, "sentiment": "positive" | "mixed" | "negative", "reply": the reply}` };
  return { max: 4000, text: `${details}

Write 10 questions and answers a homeowner would ask before hiring this business, for the business's own website FAQ and to answer customer questions on the profile. Answers 2-4 sentences, specific to the services and area, honest about what depends on the job.
${rules}
Reply with only a JSON array of 10 objects: {"q": question, "a": answer}` };
}

function parseJson(text: string): any {
  const a = text.indexOf("{"), b = text.indexOf("[");
  const start = a < 0 ? b : b < 0 ? a : Math.min(a, b);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")) + 1;
  return JSON.parse(text.slice(start, end).replace(/,\s*([}\]])/g, "$1"));
}

// Strip any phone numbers or links the model slipped into profile text.
const scrub = (s: string) => s.replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "").replace(/\s{2,}/g, " ").trim();

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to use the Business Profile toolkit.", needLogin: true }, { status: 401 });
  const prefix = `o/${owner.replace(/[^a-zA-Z0-9:_-]/g, "_")}/`;
  const url = new URL(req.url);

  if (req.method === "GET") {
    const { blobs } = await store().list({ prefix });
    const list = (await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" }) as Promise<Business | null>))).filter(Boolean) as Business[];
    list.sort((a, b) => b.updated.localeCompare(a.updated));
    return Response.json({ businesses: list, compare: serpEnabled() }, { headers: { "cache-control": "no-store" } });
  }
  if (req.method === "DELETE") { await store().delete(`${prefix}${clean(url.searchParams.get("id"), 40)}`); return Response.json({ ok: true }); }

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  if (req.method === "PUT") {
    let id = clean(body.business?.id, 40);
    if (!id) {
      const { blobs } = await store().list({ prefix });
      if (blobs.length >= MAX_BIZ) return Response.json({ error: `You can save up to ${MAX_BIZ} businesses.` }, { status: 400 });
      id = `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`;
    }
    const b = cleanBiz(body.business, id);
    if (!b) return Response.json({ error: "Add the business name, main category and city." }, { status: 400 });
    await store().setJSON(`${prefix}${id}`, b);
    return Response.json({ ok: true, business: b });
  }
  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });

  const b = (await store().get(`${prefix}${clean(body.businessId, 40)}`, { type: "json" })) as Business | null;
  if (!b) return Response.json({ error: "Save the business details first." }, { status: 400 });
  const tool = clean(body.tool, 20);
  const input = clean(body.input, 6000);

  if (tool === "compare") {
    if (!serpEnabled()) return Response.json({ error: "Competitor comparison is being switched on." }, { status: 503 });
    const payer = await payFor(req, COST, `profile compare: ${b.name}`);
    if (!payer.ok) return payer.res;
    try {
      const { places } = await page1(`${b.category} ${b.city}`, b.city);
      return Response.json({ ok: true, query: `${b.category} ${b.city}`, places, credits: payer.credits }, { headers: creditHeaders(payer) });
    } catch (e) {
      console.error("gbp compare failed", e); await payer.refund();
      return Response.json({ error: "Couldn't read Google's map results right now. Your credit was returned." }, { status: 502 });
    }
  }
  if (!["profile", "posts", "reviews", "qa"].includes(tool)) return Response.json({ error: "Unknown tool." }, { status: 400 });
  if (tool === "reviews" && input.length < 10) return Response.json({ error: "Paste at least one review to reply to." }, { status: 400 });

  const payer = await payFor(req, COST, `business profile ${tool}: ${b.name}`);
  if (!payer.ok) return payer.res;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tick = setInterval(() => { try { controller.enqueue(enc.encode(" ")); } catch {} }, 4000);
      const finish = (o: unknown) => { clearInterval(tick); controller.enqueue(enc.encode(JSON.stringify(o))); controller.close(); };
      try {
        const p = prompt(tool, b, input);
        const msg = await new Anthropic().messages.stream({ model: MODEL, max_tokens: p.max, thinking: { type: "between_tools" } as any, messages: [{ role: "user", content: p.text }] }).finalMessage();
        let out = parseJson(msg.content.map((c) => (c.type === "text" ? c.text : "")).join(""));
        if (tool === "profile") {
          out.description = scrub(String(out.description || "")).slice(0, 750);
          out.services = (out.services || []).map((s: any) => ({ name: clean(s?.name, 80), description: scrub(clean(s?.description, 300)) })).filter((s: any) => s.name);
        } else if (tool === "posts") {
          out = (Array.isArray(out) ? out : []).map((x: any) => ({ title: clean(x?.title, 80), text: scrub(clean(x?.text, 1500)), button: clean(x?.button, 20), photo: clean(x?.photo, 200) })).filter((x: any) => x.text);
        } else if (tool === "reviews") {
          out = (Array.isArray(out) ? out : []).map((x: any) => ({ review: clean(x?.review, 120), sentiment: clean(x?.sentiment, 10), reply: clean(x?.reply, 1500) })).filter((x: any) => x.reply);
        } else {
          out = (Array.isArray(out) ? out : []).map((x: any) => ({ q: clean(x?.q, 200), a: clean(x?.a, 800) })).filter((x: any) => x.q && x.a);
        }
        console.log(`gbp ${tool} for ${b.name} by ${owner}`);
        finish({ ok: true, tool, result: out, credits: payer.credits });
      } catch (e) {
        console.error("gbp tool failed", e); await payer.refund();
        finish({ ok: false, error: "That didn't come through. Your credit was returned; try again." });
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...creditHeaders(payer) } });
};

export const config: Config = {
  path: "/api/gbp",
  method: ["GET", "PUT", "POST", "DELETE"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
