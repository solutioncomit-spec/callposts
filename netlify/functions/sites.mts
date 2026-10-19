import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { clean, whoAmI } from "../lib/access.mts";
import { defaultRegion, isTheme, seoScore, type LandingPage, type Site } from "../lib/landing.mts";

// City sites: one service across up to 10 cities, with a hub page linking them all.
// The site record is created here (no charge); each city page is then built through
// POST /api/pages with { site }, which charges per page like any landing page.
//   GET    /api/sites            list the caller's sites
//   GET    /api/sites?slug=...   one site with its pages
//   POST   /api/sites            create { service, cities[], phone, brand?, region?, theme, photo? }
//   PATCH  /api/sites            update { slug, theme?, phone?, brand?, region? } (applies to every page)
//   DELETE /api/sites?slug=...   delete the site and all its pages
const MAX_CITIES = 10;
const MAX_SITES = 10;

const sites = () => getStore({ name: "sites", consistency: "strong" });
const pages = () => getStore({ name: "pages", consistency: "strong" });
const index = () => getStore({ name: "page-index", consistency: "strong" });

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to build city sites.", needLogin: true }, { status: 401 });
  const siteKey = `s/${owner}`;
  const pageKey = `o/${owner}`;
  const mine = ((await index().get(siteKey, { type: "json" })) as string[] | null) || [];
  const url = new URL(req.url);

  if (req.method === "GET") {
    const one = clean(url.searchParams.get("slug"), 80);
    if (one) {
      if (!mine.includes(one)) return Response.json({ error: "Site not found." }, { status: 404 });
      const s = (await sites().get(one, { type: "json" })) as Site | null;
      if (!s) return Response.json({ error: "Site not found." }, { status: 404 });
      const built = new Set(s.pages.map((x) => x.city));
      return Response.json({ site: { ...s, owner: undefined, missing: s.cities.filter((c) => !built.has(c)) } }, { headers: { "cache-control": "no-store" } });
    }
    const list = [];
    for (const slug of mine) {
      const s = (await sites().get(slug, { type: "json" })) as Site | null;
      if (!s) continue;
      const ps = await Promise.all(s.pages.map((x) => pages().get(x.slug, { type: "json" }) as Promise<LandingPage | null>));
      const live = ps.filter((p): p is LandingPage => !!p);
      const built = new Set(live.map((p) => p.city));
      list.push({
        slug: s.slug, service: s.service, region: s.region, theme: s.theme, phone: s.phone, photo: s.photo, created: s.created,
        cities: s.cities, built: live.length, missing: s.cities.filter((c) => !built.has(c)),
        views: (s.views || 0) + live.reduce((a, p) => a + (p.views || 0), 0),
        seo: live.length ? Math.round(live.reduce((a, p) => a + seoScore(p).score, 0) / live.length) : null,
      });
    }
    return Response.json({ sites: list }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "DELETE") {
    const slug = clean(url.searchParams.get("slug"), 80);
    if (!mine.includes(slug)) return Response.json({ error: "Site not found." }, { status: 404 });
    const s = (await sites().get(slug, { type: "json" })) as Site | null;
    if (s) {
      for (const x of s.pages) {
        const p = (await pages().get(x.slug, { type: "json" })) as LandingPage | null;
        if (p?.photo) await getStore("page-images").delete(p.photo);
        await pages().delete(x.slug);
      }
      const gone = new Set(s.pages.map((x) => x.slug));
      const pl = ((await index().get(pageKey, { type: "json" })) as string[] | null) || [];
      await index().setJSON(pageKey, pl.filter((x) => !gone.has(x)));
    }
    await sites().delete(slug);
    await index().setJSON(siteKey, mine.filter((x) => x !== slug));
    console.log(`site deleted ${slug} owner=${owner}`);
    return Response.json({ ok: true });
  }

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  if (req.method === "PATCH") {
    const slug = clean(body.slug, 80);
    if (!mine.includes(slug)) return Response.json({ error: "Site not found." }, { status: 404 });
    const s = (await sites().get(slug, { type: "json" })) as Site | null;
    if (!s) return Response.json({ error: "Site not found." }, { status: 404 });
    const upd: Partial<LandingPage> = {};
    if (isTheme(body.theme)) { s.theme = body.theme; upd.template = body.theme; }
    if (body.phone !== undefined) {
      const ph = clean(body.phone, 30);
      if (ph.replace(/\D/g, "").length < 10) return Response.json({ error: "Use a full 10-digit tracking number." }, { status: 400 });
      s.phone = ph; upd.phone = ph;
    }
    if (body.brand !== undefined && clean(body.brand, 60)) { s.brand = clean(body.brand, 60); upd.brand = s.brand; }
    if (body.region !== undefined && clean(body.region, 60)) s.region = clean(body.region, 60);
    await sites().setJSON(slug, s);
    if (Object.keys(upd).length) {
      for (const x of s.pages) {
        const p = (await pages().get(x.slug, { type: "json" })) as LandingPage | null;
        if (p) await pages().setJSON(x.slug, { ...p, ...upd });
      }
    }
    console.log(`site updated ${slug} owner=${owner} ${Object.keys(upd).join(",")}`);
    return Response.json({ ok: true });
  }

  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });

  const service = clean(body.service, 80);
  const phone = clean(body.phone, 30);
  const theme = isTheme(body.theme) ? body.theme : "clean";
  const seen = new Set<string>();
  const cities = (Array.isArray(body.cities) ? body.cities : String(body.cities || "").split(/\n|;/))
    .map((c: unknown) => clean(c, 80).replace(/\s*,\s*/g, ", ").replace(/\s+/g, " "))
    .filter((c: string) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
  if (!service) return Response.json({ error: "Add a service in the brief first." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return Response.json({ error: "Add your tracking number in the brief first. Every page is built around it." }, { status: 400 });
  if (cities.length < 2) return Response.json({ error: "Add at least 2 cities, one per line, like \"Aurora, CO\"." }, { status: 400 });
  if (cities.length > MAX_CITIES) return Response.json({ error: `A site can have up to ${MAX_CITIES} cities. Split the rest into another site.` }, { status: 400 });
  if (cities.some((c: string) => !/,\s*[A-Za-z]{2}$/.test(c))) return Response.json({ error: "Write each city with its state code, like \"Aurora, CO\"." }, { status: 400 });
  if (mine.length >= MAX_SITES) return Response.json({ error: `You have ${MAX_SITES} sites already. Delete one before making another.` }, { status: 400 });

  const region = clean(body.region, 60) || defaultRegion(cities);
  const brand = clean(body.brand, 60) || `${region} ${service.replace(/\b\w/g, (m) => m.toUpperCase())} Help`.slice(0, 60);
  const base = slugify(`${service} ${region}`);
  let slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
  while (await sites().get(slug)) slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
  const site: Site = { slug, owner, theme, service, region, phone, brand, cities, pages: [], photo: body.photo === true, created: new Date().toISOString(), views: 0 };
  await sites().setJSON(slug, site);
  await index().setJSON(siteKey, [slug, ...mine]);
  console.log(`site created ${slug} owner=${owner} cities=${cities.length} theme=${theme}`);
  return Response.json({ ok: true, slug, url: `/s/${slug}`, cities, region, brand });
};

export const config: Config = {
  path: "/api/sites",
  method: ["GET", "POST", "PATCH", "DELETE"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
