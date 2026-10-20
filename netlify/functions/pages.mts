import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { payFor, creditHeaders, clean, whoAmI } from "../lib/access.mts";
import { seoScore, isTheme, TEMPLATES, cityFile, type LandingPage, type PageCopy, type Site } from "../lib/landing.mts";
import { pingIndexNow } from "../lib/domains.mts";

// Landing page builder.
// POST   /api/pages            create a page (AI writes the copy; optional AI hero photo)
// GET    /api/pages            list the caller's pages
// DELETE /api/pages?slug=...   delete one of the caller's pages
const PAGE_COST = 3;
const PHOTO_COST = 3;
const MODEL = "claude-sonnet-5-5";

const pages = () => getStore({ name: "pages", consistency: "strong" });
const index = () => getStore({ name: "page-index", consistency: "strong" });
const images = () => getStore("page-images");
const sites = () => getStore({ name: "sites", consistency: "strong" });
const MAX_PAGES = 150;

// Add or remove a page on its city site. Retries on concurrent writes (sites build 2 pages at once).
async function updateSite(siteSlug: string, fn: (s: Site) => void) {
  for (let i = 0; i < 6; i++) {
    const got = await sites().getWithMetadata(siteSlug, { type: "json" });
    if (!got) return;
    const s = got.data as Site;
    fn(s);
    const res = await sites().setJSON(siteSlug, s, { onlyIfMatch: got.etag });
    if (res.modified) return;
  }
  console.error(`site update gave up ${siteSlug}`);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

// Pull a JSON object out of a model reply, tolerating code fences, comments and trailing commas.
function parseJsonLoose(text: string): any {
  const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(raw);
}

async function askJson(anthropic: Anthropic, prompt: string, maxTokens: number): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Stream: the AI gateway drops non-streaming requests that run longer than ~30s.
      // Thinking off: this is straightforward writing, and thinking used up the whole token budget.
      const msg = await anthropic.messages.stream({ model: MODEL, max_tokens: maxTokens, thinking: { type: "between_tools" } as any, messages: [{ role: "user", content: prompt }] }).finalMessage();
      const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      if (!text.includes("{")) throw new Error(`no JSON in reply: stop=${msg.stop_reason} types=${msg.content.map((c) => c.type).join(",")} out=${msg.usage?.output_tokens} text=${text.slice(0, 120)}`);
      return parseJsonLoose(text);
    } catch (e) { lastErr = e; console.error(`page copy attempt ${attempt + 1} failed`, String(e).slice(0, 300)); }
  }
  throw lastErr;
}

// Opening styles rotate across the pages of a city site so their first lines don't follow one pattern.
const OPENINGS = [
  "Open the intro with the most common problem homeowners in this town notice first.",
  "Open the intro with a short, practical fact about homes or climate in this town that affects this service.",
  "Open the intro with the question a homeowner here is most likely asking.",
  "Open the intro by explaining in plain words what this service covers and when people need it.",
  "Open the intro with what to do in the first hour when this problem appears.",
];

async function writeCopy(service: string, city: string, angle: string, extra: string, o: { variant?: number; siblings?: string[] } = {}): Promise<PageCopy> {
  const town = city.split(",")[0];
  const variety = o.siblings && o.siblings.length
    ? `\nThis page is one of several city pages for the same service (${o.siblings.join("; ")}). Make it read clearly differently from the others: local details specific to ${town}, its own examples, and different sentence structures. ${OPENINGS[(o.variant ?? 0) % OPENINGS.length]}`
    : `\n${OPENINGS[(o.variant ?? 0) % OPENINGS.length]}`;
  const context = `This is for an SEO landing page that should rank in Google for "${service} ${town}" and close variations ("near me" searches in ${town}, "${service.toLowerCase()} ${city}"). It is a pay-per-call page for a US home-services referral business.
Service: ${service}
City: ${city}
Angle: ${angle || "Local & trusted"}
Publisher notes / extra keywords: ${extra || "(none)"}${variety}

Writing rules:
- Specific and genuinely useful to a homeowner in ${town}. No filler, no keyword stuffing, no repeated sentences. It must read as a real local page, not a city-swapped template.
- Only state things broadly true for the area. Do not invent statistics, laws, permits or company facts.
- It is a referral service connecting homeowners with independent local pros. Never claim to be a licensed, insured, bonded or certified contractor; never promise guarantees, warranties or response times; never invent reviews, ratings, awards, years in business or customer counts.
- Never use the word "free" in any form; never imply any part of the service costs nothing.
- Never mention a price, rate, discount or dollar amount.
Reply with only one JSON object, no code fences and no comments.`;

  const promptA = `${context}

Write the top of the page. JSON keys:
"keyword": the natural phrase people search for this service, lowercase, e.g. "water heater repair" (not a plural category name),
"seoTitle": 50-60 characters with the keyword and ${town},
"metaDescription": 140-155 characters with the keyword, ${town} and a call to action,
"headline": the H1, max 70 characters, with the keyword and ${town},
"subheadline": max 170 characters,
"intro": three paragraphs separated by \n\n, 220-300 words total, first sentence uses the keyword and ${town},
"bullets": array of 4 short benefit lines,
"steps": array of 3 objects {"title", "text"} explaining call, get matched, get it fixed,
"cta": 2-5 words.`;

  const promptB = `${context}

Write the detail sections of the page. JSON keys:
"signs": array of 5 objects {"title", "text"} — signs a ${town} homeowner needs this service, text is 2 sentences,
"localNote": one paragraph of 100-140 words on why this service matters in ${town} specifically (climate, typical housing age or style, seasonal issues),
"costFactors": array of 5 one-sentence factors that affect the cost, no numbers; a call gets an exact quote,
"faqs": array of 8 objects {"q", "a"} — questions people actually search (cost factors, how long, repair vs replace, same day, signs, choosing a pro, what to do while waiting, prevention), answers 2-3 sentences,
"areas": array of 8-10 real neighborhoods or nearby suburbs of ${town} you are confident exist.`;

  const promptC = `${context}

Write the in-depth guidance sections of the page. JSON keys:
"services": array of 4-5 objects {"title", "text"} — the main types of ${service.toLowerCase()} help homeowners in ${town} call about (e.g. repair, replacement, installation, maintenance, emergency), text is 2-3 sentences each,
"repairReplace": two paragraphs separated by \n\n, 140-200 words total, on how homeowners decide between repairing and replacing (age, condition, safety, efficiency); a local pro can assess it on the call,
"choosing": array of 5 one-to-two sentence tips for choosing a provider (ask about experience with the specific job, written estimates, permits where required, clear scheduling); never claim the providers are licensed or vetted,
"seasonal": array of 4 objects {"season", "tip"} — "Spring", "Summer", "Fall", "Winter" tips that fit ${town}'s climate, 1-2 sentences each,
"areaGuide": one paragraph of 90-130 words describing the area served around ${town} in general terms (neighborhoods, nearby towns, typical housing), only things you are confident are true.`;

  const anthropic = new Anthropic();
  const [A, B, Cc] = await Promise.all([askJson(anthropic, promptA, 3500), askJson(anthropic, promptB, 4000), askJson(anthropic, promptC, 3500)]);
  const j: any = { ...A, ...B, ...Cc };
  for (const k of ["bullets", "signs", "costFactors", "steps", "faqs", "areas", "services", "choosing", "seasonal"]) {
    if (typeof j[k] === "string") { try { j[k] = JSON.parse(j[k]); } catch { j[k] = String(j[k]).split(/\n+/).map((x: string) => x.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean); } }
  }
  const noFree = (v: unknown, n: number) => clean(String(v ?? "").replace(/\n/g, "\u2029"), n).replace(/\u2029/g, "\n").replace(/\bfree\b\s*/gi, "");
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v : []).slice(0, n);
  return {
    keyword: clean(j.keyword, 60).toLowerCase(),
    seoTitle: noFree(j.seoTitle, 70),
    metaDescription: noFree(j.metaDescription, 160),
    headline: noFree(j.headline, 90),
    subheadline: noFree(j.subheadline, 220),
    intro: noFree(j.intro, 2000),
    bullets: arr(j.bullets, 6).map((b) => noFree(b, 140)),
    signs: arr(j.signs, 6).map((x: any) => ({ title: noFree(x?.title, 80), text: noFree(x?.text, 320) })),
    localNote: noFree(j.localNote, 1300),
    costFactors: arr(j.costFactors, 6).map((x) => noFree(x, 220)),
    steps: arr(j.steps, 3).map((x: any) => ({ title: noFree(x?.title, 60), text: noFree(x?.text, 220) })),
    faqs: arr(j.faqs, 10).map((f: any) => ({ q: noFree(f?.q, 160), a: noFree(f?.a, 600) })),
    services: arr(j.services, 6).map((x: any) => ({ title: noFree(x?.title, 80), text: noFree(x?.text, 400) })).filter((x) => x.title && x.text),
    repairReplace: noFree(j.repairReplace, 1600),
    choosing: arr(j.choosing, 6).map((x) => noFree(x, 260)).filter(Boolean),
    seasonal: arr(j.seasonal, 4).map((x: any) => ({ season: noFree(x?.season, 20), tip: noFree(x?.tip, 300) })).filter((x) => x.season && x.tip),
    areaGuide: noFree(j.areaGuide, 1200),
    areas: arr(j.areas, 12).map((a) => clean(a, 40)),
    cta: noFree(j.cta, 40) || "Talk to a local pro",
  };
}

async function makePhoto(service: string, city: string, dark: boolean): Promise<{ data: ArrayBuffer; type: string } | null> {
  const ai = new GoogleGenAI({});
  for (const model of ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: `A realistic, natural-looking photograph for a local ${service} service page in ${city}: a typical home and the work involved. ${dark ? "Evening light, rich contrast." : "Bright clean daylight."} Square composition. No text, no words, no letters, no numbers, no signs, no logos, no brand names, no watermarks, no recognizable faces.`,
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      });
      const part = (res.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) {
        const bytes = Uint8Array.from(atob(part.inlineData.data), (ch) => ch.charCodeAt(0));
        return { data: bytes.buffer, type: part.inlineData.mimeType || "image/png" };
      }
    } catch (e) { console.error(`page photo failed model=${model}`, e); }
  }
  return null;
}

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to build landing pages.", needLogin: true }, { status: 401 });
  const idxKey = `o/${owner}`;
  const slugs = ((await index().get(idxKey, { type: "json" })) as string[] | null) || [];

  if (req.method === "GET") {
    // One page in full, for the editor.
    const one = clean(new URL(req.url).searchParams.get("slug"), 80);
    if (one) {
      if (!slugs.includes(one)) return Response.json({ error: "Page not found." }, { status: 404 });
      const p = (await pages().get(one, { type: "json" })) as LandingPage | null;
      if (!p) return Response.json({ error: "Page not found." }, { status: 404 });
      return Response.json({ page: { slug: p.slug, site: p.site || null, template: p.template, service: p.service, city: p.city, phone: p.phone, brand: p.brand, copy: p.copy, photo: !!p.photo }, seo: seoScore(p) }, { headers: { "cache-control": "no-store" } });
    }
    const list = [];
    for (const s of slugs.slice(0, 50)) {
      const p = (await pages().get(s, { type: "json" })) as LandingPage | null;
      if (p) list.push({ slug: p.slug, site: p.site || null, service: p.service, city: p.city, phone: p.phone, template: p.template, headline: p.copy.headline, created: p.created, views: p.views || 0, photo: !!p.photo, seo: seoScore(p).score });
    }
    return Response.json({ pages: list }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "DELETE") {
    const slug = clean(new URL(req.url).searchParams.get("slug"), 80);
    if (!slugs.includes(slug)) return Response.json({ error: "Page not found." }, { status: 404 });
    const p = (await pages().get(slug, { type: "json" })) as LandingPage | null;
    if (p?.photo) await images().delete(p.photo);
    await pages().delete(slug);
    await index().setJSON(idxKey, slugs.filter((s) => s !== slug));
    if (p?.site) await updateSite(p.site, (s) => { s.pages = s.pages.filter((x) => x.slug !== slug); });
    return Response.json({ ok: true });
  }

  if (req.method === "PATCH") {
    // Edit a page: any copy field, plus phone, brand and template. Rules are enforced on save.
    let body: Record<string, any>;
    try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
    const slug = clean(body.slug, 80);
    if (!slugs.includes(slug)) return Response.json({ error: "Page not found." }, { status: 404 });
    const p = (await pages().get(slug, { type: "json" })) as LandingPage | null;
    if (!p) return Response.json({ error: "Page not found." }, { status: 404 });
    const txt = (v: unknown, n: number) => clean(String(v ?? "").replace(/\r/g, "").replace(/\n/g, "\u2029"), n).replace(/\u2029/g, "\n");
    const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).map((x) => txt(x, len)).filter(Boolean).slice(0, n);
    const pairs = (v: unknown, a: string, b: string, n: number) => (Array.isArray(v) ? v : []).map((x: any) => ({ [a]: txt(x?.[a], 200), [b]: txt(x?.[b], 700) })).filter((x: any) => x[a] && x[b]).slice(0, n);
    if (body.phone !== undefined) {
      const ph = clean(body.phone, 30);
      if (ph.replace(/\D/g, "").length < 10) return Response.json({ error: "Use a full 10-digit tracking number." }, { status: 400 });
      p.phone = ph;
    }
    if (body.brand !== undefined) p.brand = clean(body.brand, 60);
    if (isTheme(body.template)) p.template = body.template;
    const c = body.copy || {};
    const next: PageCopy = { ...p.copy };
    if (c.keyword !== undefined) next.keyword = clean(c.keyword, 60).toLowerCase();
    if (c.seoTitle !== undefined) next.seoTitle = txt(c.seoTitle, 80);
    if (c.metaDescription !== undefined) next.metaDescription = txt(c.metaDescription, 200);
    if (c.headline !== undefined) next.headline = txt(c.headline, 120);
    if (c.subheadline !== undefined) next.subheadline = txt(c.subheadline, 260);
    if (c.intro !== undefined) next.intro = txt(c.intro, 4000);
    if (c.localNote !== undefined) next.localNote = txt(c.localNote, 3000);
    if (c.cta !== undefined) next.cta = txt(c.cta, 50);
    if (c.bullets !== undefined) next.bullets = list(c.bullets, 8, 160);
    if (c.costFactors !== undefined) next.costFactors = list(c.costFactors, 8, 260);
    if (c.areas !== undefined) next.areas = list(c.areas, 16, 50);
    if (c.signs !== undefined) next.signs = pairs(c.signs, "title", "text", 8) as any;
    if (c.steps !== undefined) next.steps = pairs(c.steps, "title", "text", 4) as any;
    if (c.faqs !== undefined) next.faqs = pairs(c.faqs, "q", "a", 12) as any;
    if (c.services !== undefined) next.services = pairs(c.services, "title", "text", 8) as any;
    if (c.seasonal !== undefined) next.seasonal = pairs(c.seasonal, "season", "tip", 6) as any;
    if (c.choosing !== undefined) next.choosing = list(c.choosing, 8, 300);
    if (c.repairReplace !== undefined) next.repairReplace = txt(c.repairReplace, 3000);
    if (c.areaGuide !== undefined) next.areaGuide = txt(c.areaGuide, 2000);
    if (!next.headline) return Response.json({ error: "The main heading can't be empty." }, { status: 400 });
    const flat = JSON.stringify(next);
    if (/\bfree\b/i.test(flat)) return Response.json({ error: "The copy uses the word \"free\". Remove it before saving; it breaks the listing rules." }, { status: 400 });
    if (/\$\s?\d/.test(flat)) return Response.json({ error: "The copy shows a dollar amount. Remove prices before saving." }, { status: 400 });
    p.copy = next;
    await pages().setJSON(slug, p);
    console.log(`page edited ${slug} owner=${owner}`);
    return Response.json({ ok: true, seo: seoScore(p) });
  }

  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  let service = clean(body.service, 80);
  const city = clean(body.city, 80);
  let phone = clean(body.phone, 30);
  let brand = clean(body.brand, 60);
  const angle = clean(body.angle, 40);
  const extra = clean(body.extra, 300);
  let template: LandingPage["template"] = isTheme(body.template) ? body.template : "clean";
  let withPhoto = body.photo === true;
  // Building a page for a city site: the site decides service, number, brand, theme and photo.
  const siteSlug = clean(body.site, 80);
  let site: Site | null = null;
  if (siteSlug) {
    site = (await sites().get(siteSlug, { type: "json" })) as Site | null;
    if (!site || site.owner !== owner) return Response.json({ error: "Site not found." }, { status: 404 });
    if (!site.cities.includes(city)) return Response.json({ error: "That city isn't part of this site." }, { status: 400 });
    if (site.pages.some((x) => x.city === city)) return Response.json({ error: `${city} is already built.`, already: true }, { status: 409 });
    service = site.service; phone = site.phone; brand = site.brand; template = site.theme; withPhoto = site.photo;
  }
  if (!service || !city) return Response.json({ error: "Add a service and a city in the brief first." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return Response.json({ error: "Add your tracking number in the brief first. The page is built around it." }, { status: 400 });
  if (slugs.length >= MAX_PAGES) return Response.json({ error: `You have ${MAX_PAGES} pages already. Delete some before making more.` }, { status: 400 });

  const cost = PAGE_COST + (withPhoto ? PHOTO_COST : 0);
  const payer = await payFor(req, cost, `landing page: ${service}, ${city}${withPhoto ? " + photo" : ""}`);
  if (!payer.ok) return payer.res;

  // Writing a long SEO page can take 30-50s. Stream a space every few seconds so the
  // connection isn't cut for inactivity, then send the JSON result at the end.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tick = setInterval(() => { try { controller.enqueue(enc.encode(" ")); } catch {} }, 4000);
      const finish = (obj: unknown) => { clearInterval(tick); controller.enqueue(enc.encode(JSON.stringify(obj))); controller.close(); };
      try {
        const [copy, photo] = await Promise.all([
          writeCopy(service, city, angle, extra, site ? { variant: site.cities.indexOf(city), siblings: site.cities.filter((x) => x !== city) } : { variant: Math.floor(Math.random() * 5) }),
          withPhoto ? makePhoto(service, city, TEMPLATES[template].dark) : Promise.resolve(null),
        ]);
        const base = slugify(`${service} ${city.split(",")[0]}`);
        let slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
        while (await pages().get(slug)) slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
        const page: LandingPage = { slug, owner, template, service, city, phone, brand, copy, created: new Date().toISOString(), views: 0, ...(site ? { site: site.slug, variant: site.cities.indexOf(city) } : {}) };
        let credits = payer.credits;
        if (photo) {
          page.photo = `img/${slug}`;
          await images().set(page.photo, photo.data, { metadata: { type: photo.type } });
        } else if (withPhoto && payer.kind === "user") {
          // Photo failed but the page worked: give back just the photo credits.
          await payer.refund();
          const again = await payFor(req, PAGE_COST, `landing page: ${service}, ${city}`);
          credits = again.ok && again.kind === "user" ? again.credits : credits;
        }
        await pages().setJSON(slug, page);
        // Concurrent builds (city sites) write this list at the same time, so retry on conflict.
        for (let i = 0; i < 6; i++) {
          const got = await index().getWithMetadata(idxKey, { type: "json" });
          const latest = ((got?.data as string[] | null) || []).filter((x) => x !== slug);
          const res = got ? await index().setJSON(idxKey, [slug, ...latest], { onlyIfMatch: got.etag }) : await index().setJSON(idxKey, [slug], { onlyIfNew: true });
          if (res.modified) break;
        }
        if (site) {
          const order = site.cities;
          await updateSite(site.slug, (s) => { s.pages = [...s.pages.filter((x) => x.city !== city), { slug, city }].sort((a, b) => order.indexOf(a.city) - order.indexOf(b.city)); });
        }
        const words = seoScore(page).words;
        // Tell search engines about the new page right away (IndexNow; best effort).
        const origin = new URL(req.url).origin;
        const fresh = site?.domain ? [`https://${site.domain}/${cityFile(page)}`, `https://${site.domain}/`] : [`${origin}/p/${slug}`, ...(site ? [`${origin}/s/${site.slug}`] : [])];
        await pingIndexNow(fresh).catch(() => null);
        console.log(`page created ${slug} owner=${owner} site=${site?.slug || "-"} template=${template} photo=${!!photo} words=${words}`);
        finish({ ok: true, slug, url: `/p/${slug}`, photo: !!photo, words, credits });
      } catch (e) {
        console.error("page create failed", e);
        await payer.refund();
        finish({ ok: false, error: "The page didn't come through. Your credits were returned; try again.", ...(payer.kind === "code" ? { detail: String((e as Error)?.message || e).slice(0, 300) } : {}) });
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...creditHeaders(payer) } });
};

export const config: Config = {
  path: "/api/pages",
  method: ["GET", "POST", "PATCH", "DELETE"],
  rateLimit: { windowLimit: 25, windowSize: 60, aggregateBy: ["ip", "domain"] },
};

