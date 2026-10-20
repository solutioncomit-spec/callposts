import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { payFor, creditHeaders, clean, whoAmI } from "../lib/access.mts";
import { siteServices, slugPart, siteLinks, type Post, type Site } from "../lib/landing.mts";
import { pingIndexNow } from "../lib/domains.mts";

// Blog posts for a site: helpful articles that link into its service and city pages.
//   POST   /api/posts { site, service?, topic? }  → writes one article (2 credits)
//   DELETE /api/posts?site=...&slug=...          → removes it
const COST = 2;
const MAX_POSTS = 30;
const MODEL = "claude-sonnet-5-5";
const sites = () => getStore({ name: "sites", consistency: "strong" });
const posts = () => getStore({ name: "posts", consistency: "strong" });

async function updateSite(slug: string, fn: (s: Site) => void) {
  for (let i = 0; i < 6; i++) {
    const got = await sites().getWithMetadata(slug, { type: "json" });
    if (!got) return;
    const s = got.data as Site;
    fn(s);
    const res = await sites().setJSON(slug, s, { onlyIfMatch: got.etag });
    if (res.modified) return;
  }
}

function parseJson(text: string): any {
  const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(raw);
}

async function writePost(site: Site, service: string, topic: string, existing: string[]) {
  const towns = site.cities.map((c) => c.split(",")[0]).join(", ");
  const prompt = `Write a helpful blog article for a home-services referral website serving ${site.region} (${towns}).
Service it relates to: ${service}
${topic ? `Topic requested by the publisher: ${topic}` : `Choose a specific, practical topic homeowners in ${site.region} actually search for about ${service.toLowerCase()}: a problem, a seasonal concern, a decision, or what to expect. Not a sales pitch.`}
Articles already on the site (do not repeat their topics): ${existing.length ? existing.join(" | ") : "(none)"}

Rules:
- Genuinely useful, specific and accurate general guidance. 900-1,200 words in total. Plain English, short paragraphs.
- Mention ${site.region} or its towns naturally where it helps; only state local facts you are confident are true (climate, typical housing). No invented statistics, laws, permit rules, studies or quotes.
- The site is a referral service that connects homeowners with independent local pros. Never claim to be a contractor; never claim providers are licensed, insured, vetted or guaranteed; never invent reviews or customer stories presented as real.
- Never use the word "free" in any form. Never mention a price, rate, discount or dollar amount.
- Include safety guidance where relevant (for gas, electrical or water hazards, tell readers to contact the utility or emergency services first).
- End the last section by suggesting a call to talk to a local pro, without pressure.
Reply with only one JSON object, no code fences: {"title": 50-70 characters, "metaDescription": 140-155 characters, "keyword": the main search phrase, "intro": two short paragraphs separated by \\n\\n, "sections": array of 5-6 objects {"heading", "body"} where body is 1-3 paragraphs separated by \\n\\n, "faqs": array of 3 objects {"q", "a"} with 2-3 sentence answers}`;
  const anthropic = new Anthropic();
  let last: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const msg = await anthropic.messages.stream({ model: MODEL, max_tokens: 5000, thinking: { type: "between_tools" } as any, messages: [{ role: "user", content: prompt }] }).finalMessage();
      return parseJson(msg.content.map((c) => (c.type === "text" ? c.text : "")).join(""));
    } catch (e) { last = e; console.error(`post attempt ${i + 1} failed`, String(e).slice(0, 200)); }
  }
  throw last;
}

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to write blog posts.", needLogin: true }, { status: 401 });
  const url = new URL(req.url);

  if (req.method === "DELETE") {
    const siteSlug = clean(url.searchParams.get("site"), 80);
    const slug = clean(url.searchParams.get("slug"), 90);
    const site = (await sites().get(siteSlug, { type: "json" })) as Site | null;
    if (!site || site.owner !== owner) return Response.json({ error: "Site not found." }, { status: 404 });
    await posts().delete(`${siteSlug}/${slug}`);
    await updateSite(siteSlug, (s) => { s.posts = (s.posts || []).filter((x) => x.slug !== slug); });
    return Response.json({ ok: true });
  }
  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  const siteSlug = clean(body.site, 80);
  const site = (await sites().get(siteSlug, { type: "json" })) as Site | null;
  if (!site || site.owner !== owner) return Response.json({ error: "Site not found." }, { status: 404 });
  if ((site.posts || []).length >= MAX_POSTS) return Response.json({ error: `A site can have up to ${MAX_POSTS} posts.` }, { status: 400 });
  const svcs = siteServices(site);
  const askedSvc = clean(body.service, 80);
  // Rotate services so a site's articles spread across what it offers.
  const service = svcs.includes(askedSvc) ? askedSvc : svcs[(site.posts || []).length % svcs.length];
  const topic = clean(body.topic, 160).replace(/\bfree\b/gi, "");

  const payer = await payFor(req, COST, `blog post: ${site.region}, ${service}`);
  if (!payer.ok) return payer.res;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tick = setInterval(() => { try { controller.enqueue(enc.encode(" ")); } catch {} }, 4000);
      const finish = (obj: unknown) => { clearInterval(tick); controller.enqueue(enc.encode(JSON.stringify(obj))); controller.close(); };
      try {
        const j = await writePost(site, service, topic, (site.posts || []).map((x) => x.title));
        const noFree = (v: unknown, n: number) => clean(String(v ?? "").replace(/\n/g, "\u2029"), n).replace(/\u2029/g, "\n").replace(/\bfree\b\s*/gi, "");
        const title = noFree(j.title, 90);
        const sections = (Array.isArray(j.sections) ? j.sections : []).map((x: any) => ({ heading: noFree(x?.heading, 120), body: noFree(x?.body, 3000) })).filter((x: any) => x.heading && x.body).slice(0, 8);
        if (!title || sections.length < 3) throw new Error("article came back incomplete");
        const flat = JSON.stringify(j);
        if (/\$\s?\d/.test(flat)) console.log("post mentioned a dollar amount; removed");
        const stripPrices = (x: string) => x.replace(/\$\s?\d[\d,]*(\.\d+)?/g, "").replace(/\s{2,}/g, " ");
        let slug = slugPart(title).slice(0, 70) || `post-${Date.now().toString(36)}`;
        if ((site.posts || []).some((x) => x.slug === slug)) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        const post: Post = {
          slug, site: site.slug, title: stripPrices(title), service, keyword: noFree(j.keyword, 80),
          metaDescription: stripPrices(noFree(j.metaDescription, 170)), intro: stripPrices(noFree(j.intro, 2000)),
          sections: sections.map((x: any) => ({ heading: stripPrices(x.heading), body: stripPrices(x.body) })),
          faqs: (Array.isArray(j.faqs) ? j.faqs : []).map((f: any) => ({ q: stripPrices(noFree(f?.q, 200)), a: stripPrices(noFree(f?.a, 700)) })).filter((f: any) => f.q && f.a).slice(0, 5),
          created: new Date().toISOString(),
        };
        await posts().setJSON(`${site.slug}/${slug}`, post);
        await updateSite(site.slug, (s) => { s.posts = [{ slug, title: post.title, service, created: post.created }, ...(s.posts || []).filter((x) => x.slug !== slug)]; });
        const L = siteLinks(site, site.domain ? "domain" : "hosted");
        const origin = site.domain ? `https://${site.domain}` : url.origin;
        await pingIndexNow([`${origin}${L.post(slug)}`, `${origin}${L.blogIndex}`]).catch(() => null);
        const words = [post.intro, ...post.sections.map((x) => `${x.heading} ${x.body}`), ...(post.faqs || []).map((f) => `${f.q} ${f.a}`)].join(" ").split(/\s+/).filter(Boolean).length;
        console.log(`post created ${site.slug}/${slug} owner=${owner} words=${words}`);
        finish({ ok: true, slug, title: post.title, url: siteLinks(site, "hosted").post(slug), words, credits: payer.credits });
      } catch (e) {
        console.error("post failed", e);
        await payer.refund();
        finish({ ok: false, error: "The article didn't come through. Your credits were returned; try again.", ...(payer.kind === "code" ? { detail: String((e as Error)?.message || e).slice(0, 300) } : {}) });
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...creditHeaders(payer) } });
};

export const config: Config = {
  path: "/api/posts",
  method: ["POST", "DELETE"],
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
