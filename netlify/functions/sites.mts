import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { clean, whoAmI } from "../lib/access.mts";
import { defaultRegion, isTheme, seoScore, siteServices, isMulti, siteLinks, type LandingPage, type Site } from "../lib/landing.mts";
import { cleanHost, checkDns, setAlias, pingIndexNow, domainsStore, domainsEnabled, NETLIFY_APEX_IP, NETLIFY_HOST } from "../lib/domains.mts";

// City sites: one service across up to 10 cities, or up to 5 services across several cities (every service in every city),
// with a home page, service and area pages, and optional blog posts (see /api/posts).
// The site record is created here (no charge); each city page is then built through
// POST /api/pages with { site }, which charges per page like any landing page.
//   GET    /api/sites            list the caller's sites
//   GET    /api/sites?slug=...   one site with its pages
//   POST   /api/sites            create { service | services[], cities[], phone, brand?, region?, theme, photo? }
//   PATCH  /api/sites            update { slug, theme?, phone?, brand?, region? } (applies to every page)
//                                { slug, domain: "www.example.com" } connect a custom domain ("" disconnects)
//                                { slug, ping: true } submit the site's URLs to search engines (IndexNow)
//   DELETE /api/sites?slug=...   delete the site and all its pages
const MAX_CITIES = 10;
const MAX_SITES = 10;
const MAX_SERVICES = 5;
const MAX_COMBO_PAGES = 24; // services x cities on a multi-service site

// Every service-in-city page the site should have, and which are still missing.
const combos = (s: Site) => siteServices(s).flatMap((service) => s.cities.map((city) => ({ service, city })));
const missingOf = (s: Site) => {
  const have = new Set(s.pages.map((x) => `${x.service || s.service}|${x.city}`));
  return combos(s).filter((c) => !have.has(`${c.service}|${c.city}`));
};
// Every public URL of a site, on its own domain when connected, otherwise on callposts.com.
function allUrls(s: Site, origin: string): string[] {
  const L = siteLinks(s, s.domain ? "domain" : "hosted");
  const abs = (x: string) => (s.domain ? `https://${s.domain}${x}` : `${origin}${x}`);
  const out = [L.home, ...s.pages.map((p) => L.combo(p))];
  if (isMulti(s)) out.push(...siteServices(s).map((v) => L.service(v)), ...s.cities.map((c) => L.area(c)));
  if (s.posts?.length) out.push(L.blogIndex, ...s.posts.map((x) => L.post(x.slug)));
  return out.map(abs);
}

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
      return Response.json({ site: { ...s, owner: undefined, services: siteServices(s), missing: missingOf(s) } }, { headers: { "cache-control": "no-store" } });
    }
    const list = [];
    for (const slug of mine) {
      const s = (await sites().get(slug, { type: "json" })) as Site | null;
      if (!s) continue;
      const ps = await Promise.all(s.pages.map((x) => pages().get(x.slug, { type: "json" }) as Promise<LandingPage | null>));
      const live = ps.filter((p): p is LandingPage => !!p);
      list.push({
        slug: s.slug, service: s.service, services: siteServices(s), region: s.region, mode: s.mode || "referral", brand: s.brand, theme: s.theme, phone: s.phone, photo: s.photo, created: s.created,
        domain: s.domain || null, pingedAt: s.pingedAt || null, posts: (s.posts || []).map((x) => ({ slug: x.slug, title: x.title })),
        cities: s.cities, total: combos(s).length, built: live.length, missing: missingOf(s),
        views: (s.views || 0) + live.reduce((a, p) => a + (p.views || 0), 0),
        seo: live.length ? Math.round(live.reduce((a, p) => a + seoScore(p).score, 0) / live.length) : null,
      });
    }
    return Response.json({ sites: list, domains: { enabled: domainsEnabled(), apexIp: NETLIFY_APEX_IP, cname: NETLIFY_HOST } }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "DELETE") {
    const slug = clean(url.searchParams.get("slug"), 80);
    if (!mine.includes(slug)) return Response.json({ error: "Site not found." }, { status: 404 });
    const s = (await sites().get(slug, { type: "json" })) as Site | null;
    if (s) {
      for (const x of s.posts || []) await getStore({ name: "posts", consistency: "strong" }).delete(`${s.slug}/${x.slug}`);
      for (const x of s.pages) {
        const p = (await pages().get(x.slug, { type: "json" })) as LandingPage | null;
        if (p?.photo) await getStore("page-images").delete(p.photo);
        await pages().delete(x.slug);
      }
      const gone = new Set(s.pages.map((x) => x.slug));
      const pl = ((await index().get(pageKey, { type: "json" })) as string[] | null) || [];
      await index().setJSON(pageKey, pl.filter((x) => !gone.has(x)));
    }
    if (s?.domain) {
      await domainsStore().delete(s.domain);
      try { await setAlias(s.domain, false); } catch (e) { console.error("alias remove failed", e); }
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
    // Public URLs of the site: on its own domain when connected, otherwise on callposts.com.
    const siteUrls = () => allUrls(s, new URL(req.url).origin);

    if (body.ping === true) {
      if (!s.pages.length) return Response.json({ error: "Build at least one city page first." }, { status: 400 });
      if (s.pingedAt && Date.now() - Date.parse(s.pingedAt) < 60 * 60 * 1000) return Response.json({ error: "Already submitted in the last hour. Search engines don't need it more often." }, { status: 429 });
      const r = await pingIndexNow(siteUrls());
      if (!r.ok) return Response.json({ error: `The submission didn't go through (status ${r.status}). Try again later.` }, { status: 502 });
      s.pingedAt = new Date().toISOString();
      await sites().setJSON(slug, s);
      return Response.json({ ok: true, urls: siteUrls().length, pingedAt: s.pingedAt });
    }

    if (body.domain !== undefined) {
      if (!domainsEnabled()) return Response.json({ error: "Custom domains aren't switched on for CallPosts yet. Try again soon." }, { status: 503 });
      const raw = String(body.domain || "").trim();
      if (!raw) {
        if (s.domain) {
          await domainsStore().delete(s.domain);
          try { await setAlias(s.domain, false); } catch (e) { console.error("alias remove failed", e); }
          console.log(`domain disconnected ${s.domain} site=${slug}`);
          s.domain = undefined;
          await sites().setJSON(slug, s);
        }
        return Response.json({ ok: true, domain: null });
      }
      const host = cleanHost(raw);
      if (!host) return Response.json({ error: "That doesn't look like a domain. Use something like www.yourdomain.com." }, { status: 400 });
      const taken = await domainsStore().get(host);
      if (taken && taken !== slug) return Response.json({ error: "That domain is already connected to another site." }, { status: 409 });
      const dns = await checkDns(host);
      if (!dns.ok) {
        return Response.json({ ok: false, dns: false, host, found: dns.found,
          error: dns.found.length ? `${host} points somewhere else right now (${dns.found.slice(0, 3).join(", ")}). Update the DNS record, wait a few minutes, then check again.` : `No DNS record found for ${host} yet. Add the record, wait a few minutes (sometimes up to an hour), then check again.` }, { status: 409 });
      }
      try { await setAlias(host, true); }
      catch (e) { console.error("alias add failed", e); return Response.json({ error: "Couldn't attach the domain right now. Try again in a minute." }, { status: 502 }); }
      if (s.domain && s.domain !== host) { await domainsStore().delete(s.domain); try { await setAlias(s.domain, false); } catch {} }
      await domainsStore().set(host, slug);
      s.domain = host;
      await sites().setJSON(slug, s);
      console.log(`domain connected ${host} site=${slug} owner=${owner}`);
      // Let search engines know about the new home of these pages (best effort).
      await pingIndexNow(siteUrls()).catch(() => null);
      return Response.json({ ok: true, domain: host });
    }

    const upd: Partial<LandingPage> = {};
    if (isTheme(body.theme)) { s.theme = body.theme; upd.template = body.theme; }
    if (body.phone !== undefined) {
      const ph = clean(body.phone, 30);
      if (ph.replace(/\D/g, "").length < 10) return Response.json({ error: "Use a full 10-digit tracking number." }, { status: 400 });
      s.phone = ph; upd.phone = ph;
    }
    if (body.brand !== undefined && clean(body.brand, 60)) { s.brand = clean(body.brand, 60); upd.brand = s.brand; }
    if (body.region !== undefined && clean(body.region, 60)) s.region = clean(body.region, 60);
    if (body.facts !== undefined && s.mode === "business") s.facts = clean(body.facts, 1500);
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

  const svcSeen = new Set<string>();
  const services = (Array.isArray(body.services) ? body.services : String(body.services || body.service || "").split(/\n|;/))
    .map((v: unknown) => clean(v, 80))
    .filter((v: string) => v && !svcSeen.has(v.toLowerCase()) && svcSeen.add(v.toLowerCase()));
  const service = services[0] || "";
  const multi = services.length > 1;
  const phone = clean(body.phone, 30);
  const biz = body.mode === "business";
  const facts = clean(body.facts, 1500);
  const theme = isTheme(body.theme) ? body.theme : "clean";
  const seen = new Set<string>();
  const cities = (Array.isArray(body.cities) ? body.cities : String(body.cities || "").split(/\n|;/))
    .map((c: unknown) => clean(c, 80).replace(/\s*,\s*/g, ", ").replace(/\s+/g, " "))
    .filter((c: string) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()));
  if (!service) return Response.json({ error: "Add a service in the brief first." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return Response.json({ error: biz ? "Add the business phone number in the brief first." : "Add your tracking number in the brief first. Every page is built around it." }, { status: 400 });
  if (biz && !clean(body.brand, 60)) return Response.json({ error: "Add the business name (Brand / page name in the brief)." }, { status: 400 });
  if (services.length > MAX_SERVICES) return Response.json({ error: `A site can have up to ${MAX_SERVICES} services.` }, { status: 400 });
  if (!multi && !biz && cities.length < 2) return Response.json({ error: "Add at least 2 cities, one per line, like \"Aurora, CO\"." }, { status: 400 });
  if ((multi || biz) && cities.length < 1) return Response.json({ error: "Add at least 1 city, like \"Aurora, CO\"." }, { status: 400 });
  if (multi && services.length * cities.length > MAX_COMBO_PAGES) return Response.json({ error: `${services.length} services × ${cities.length} cities is ${services.length * cities.length} pages. A site can have up to ${MAX_COMBO_PAGES}; remove some services or cities.` }, { status: 400 });
  if (cities.length > MAX_CITIES) return Response.json({ error: `A site can have up to ${MAX_CITIES} cities. Split the rest into another site.` }, { status: 400 });
  if (cities.some((c: string) => !/,\s*[A-Za-z]{2}$/.test(c))) return Response.json({ error: "Write each city with its state code, like \"Aurora, CO\"." }, { status: 400 });
  if (mine.length >= MAX_SITES) return Response.json({ error: `You have ${MAX_SITES} sites already. Delete one before making another.` }, { status: 400 });

  const region = clean(body.region, 60) || defaultRegion(cities);
  const brand = clean(body.brand, 60) || (multi ? `${region} Home Service Help` : `${region} ${service.replace(/\b\w/g, (m) => m.toUpperCase())} Help`).slice(0, 60);
  const base = slugify(multi ? `home services ${region}` : `${service} ${region}`);
  let slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
  while (await sites().get(slug)) slug = `${base}-${crypto.randomUUID().slice(0, 5)}`;
  const site: Site = { slug, owner, theme, service, region, phone, brand, cities, pages: [], photo: body.photo === true, created: new Date().toISOString(), views: 0, ...(multi ? { services } : {}), ...(biz ? { mode: "business" as const, facts } : {}), posts: [] };
  await sites().setJSON(slug, site);
  await index().setJSON(siteKey, [slug, ...mine]);
  console.log(`site created ${slug} owner=${owner} services=${services.length} cities=${cities.length} theme=${theme}`);
  return Response.json({ ok: true, slug, url: `/s/${slug}`, cities, services, combos: combos(site), region, brand });
};

export const config: Config = {
  path: "/api/sites",
  method: ["GET", "POST", "PATCH", "DELETE"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
