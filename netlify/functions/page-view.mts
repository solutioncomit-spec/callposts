import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { renderLanding, renderHub, renderPrivacy, samplePage, isTheme, cityFile, type LandingPage, type Site, type SiteNav } from "../lib/landing.mts";
import { INDEXNOW_KEY } from "../lib/domains.mts";
import { makeZip } from "../lib/zip.mts";

// Public pages:
//   /p/:slug            a hosted landing page        /p-img/:slug   its photo
//   /s/:slug            a city site's hub page       /s/:slug/site.zip  the whole site as a ZIP
//   /theme/:key         theme preview with sample copy
//   /cd/:site/...       a city site on its own custom domain (the domains edge function rewrites requests here)
const pagesStore = () => getStore({ name: "pages", consistency: "strong" });
const sitesStore = () => getStore({ name: "sites", consistency: "strong" });
const html = (body: string, extra: Record<string, string> = {}) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...extra } });
const notFound = () => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font:16px system-ui;background:#0b0c10;color:#f4f4f5;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>This page isn't available</h1><p>It may have been removed by its owner.</p></div>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

const pageBrand = (p: LandingPage) => p.brand || `${p.city.split(",")[0]} ${(p.copy.keyword || p.service).replace(/\b\w/g, (m) => m.toUpperCase())} Help`;
const siteBrand = (s: Site) => s.brand || `${s.region} ${s.service} Help`;
const privacyFor = (s: Site, homeHref: string) => renderPrivacy({ theme: s.theme, brand: siteBrand(s), phone: s.phone, homeHref, homeName: siteBrand(s) });

async function sitePages(site: Site): Promise<LandingPage[]> {
  const list = await Promise.all(site.pages.map((x) => pagesStore().get(x.slug, { type: "json" }) as Promise<LandingPage | null>));
  const order = (c: string) => { const i = site.cities.indexOf(c); return i < 0 ? 999 : i; };
  return list.filter((p): p is LandingPage => !!p).sort((a, b) => order(a.city) - order(b.city));
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = url.origin;

  if (path.startsWith("/theme/")) {
    const key = String(context.params.key || "");
    if (!isTheme(key)) return notFound();
    const nav: SiteNav = { hubName: "Water Heater Repair in Colorado", hubHref: "#", cities: [{ name: "Aurora, CO", href: "#", current: true }, { name: "Denver, CO", href: "#" }, { name: "Lakewood, CO", href: "#" }] };
    const photo = url.searchParams.get("photo") === "0" ? undefined : `${origin}/img/water-heater.jpg`;
    return html(renderLanding(samplePage(key), { photoUrl: photo, site: nav }), { "x-robots-tag": "noindex", "cache-control": "public, max-age=600" });
  }

  if (path.startsWith("/cd/")) return customDomain(url);

  const slug = String(context.params.slug || "").slice(0, 80);
  if (!/^[a-z0-9-]+$/.test(slug)) return notFound();

  if (path.startsWith("/p-img/")) {
    const got = await getStore("page-images").getWithMetadata(`img/${slug}`, { type: "arrayBuffer" });
    if (!got?.data) return new Response("Not found", { status: 404 });
    return new Response(got.data as ArrayBuffer, { headers: { "content-type": String(got.metadata?.type || "image/png"), "cache-control": "public, max-age=86400" } });
  }

  if (path.startsWith("/s/")) {
    const site = (await sitesStore().get(slug, { type: "json" })) as Site | null;
    if (!site) return notFound();
    if (path.endsWith("/privacy")) return html(privacyFor(site, `/s/${slug}`), { "x-robots-tag": "noindex" });
    const pages = await sitePages(site);
    if (!pages.length) return notFound();
    const withPhoto = pages.find((p) => p.photo);

    if (path.endsWith("/site.zip")) {
      // Self-contained copy for the publisher's own hosting: relative links, local images, no canonical back to us.
      const files: { name: string; data: Uint8Array | string }[] = [];
      const imgName = new Map<string, string>();
      for (const p of pages) {
        if (!p.photo) continue;
        const got = await getStore("page-images").getWithMetadata(p.photo, { type: "arrayBuffer" });
        if (!got?.data) continue;
        const type = String(got.metadata?.type || "image/png");
        const name = `images/${p.slug}.${type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png"}`;
        imgName.set(p.slug, name);
        files.push({ name, data: new Uint8Array(got.data as ArrayBuffer) });
      }
      // Friendly file names for self-hosting: aurora-co.html, denver-co.html ...
      const cityHref = (p: LandingPage) => `${cityFile(p)}.html`;
      const nav = (cur: LandingPage): SiteNav => ({ hubName: `${site.service} in ${site.region}`, hubHref: "index.html", cities: pages.map((p) => ({ name: p.city, href: cityHref(p), current: p.slug === cur.slug })) });
      files.unshift({ name: "index.html", data: renderHub(site, pages, { cityHref, selfHref: "index.html", photoUrl: withPhoto ? imgName.get(withPhoto.slug) : undefined, privacyHref: "privacy.html" }) });
      for (const p of pages) files.push({ name: cityHref(p), data: renderLanding(p, { photoUrl: imgName.get(p.slug), site: nav(p), privacyHref: "privacy.html" }) });
      files.push({ name: "privacy.html", data: privacyFor(site, "index.html") });
      return new Response(makeZip(files), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${site.slug}.zip"`, "cache-control": "no-store" } });
    }

    if (url.searchParams.get("preview") !== "1") {
      site.views = (site.views || 0) + 1;
      sitesStore().setJSON(slug, site).catch(() => {});
    }
    return html(renderHub(site, pages, { base: origin, selfHref: `/s/${slug}`, cityHref: (p) => `/p/${p.slug}`, photoUrl: withPhoto ? `${origin}/p-img/${withPhoto.slug}` : undefined, canonical: site.domain ? `https://${site.domain}/` : undefined, privacyHref: `/s/${slug}/privacy` }));
  }

  const store = pagesStore();
  const page = (await store.get(slug, { type: "json" })) as LandingPage | null;
  if (!page) return notFound();
  if (path.endsWith("/privacy")) {
    return html(renderPrivacy({ theme: page.template, brand: pageBrand(page), phone: page.phone, homeHref: `/p/${slug}`, homeName: pageBrand(page) }), { "x-robots-tag": "noindex" });
  }

  // Best-effort view counter (skip the owner's own previews).
  if (url.searchParams.get("preview") !== "1" && url.searchParams.get("download") !== "1") {
    page.views = (page.views || 0) + 1;
    store.setJSON(slug, page).catch(() => {});
  }

  const photoUrl = page.photo ? `${origin}/p-img/${slug}` : undefined;
  // Downloaded copies go on the publisher's own domain, so they must not point Google back here.
  const download = url.searchParams.get("download") === "1";
  let site: SiteNav | undefined;
  let canonical: string | undefined;
  if (page.site && !download) {
    const s = (await sitesStore().get(page.site, { type: "json" })) as Site | null;
    if (s) {
      site = { hubName: `${s.service} in ${s.region}`, hubHref: `/s/${s.slug}`, cities: s.pages.map((x) => ({ name: x.city, href: `/p/${x.slug}`, current: x.slug === slug })) };
      // Once the site has its own domain, that copy is the one Google should index.
      if (s.domain) canonical = `https://${s.domain}/${cityFile(page)}`;
    }
  }
  // A downloaded page keeps a full link to its hosted privacy policy; hosted pages link within the site.
  const privacyHref = download ? `${origin}/p/${slug}/privacy` : page.site && site ? `/s/${page.site}/privacy` : `/p/${slug}/privacy`;
  return html(renderLanding(page, { photoUrl, base: download ? undefined : origin, site, canonical, privacyHref }));
};

// A city site served on its own domain: / is the hub, /aurora-co a city page, plus sitemap, robots and images.
async function customDomain(url: URL): Promise<Response> {
  const [, , siteSlug = "", ...restParts] = url.pathname.split("/");
  const rest = restParts.join("/").replace(/\/$/, "");
  if (!/^[a-z0-9-]+$/.test(siteSlug)) return notFound();
  const site = (await sitesStore().get(siteSlug, { type: "json" })) as Site | null;
  if (!site || !site.domain) return notFound();
  const base = `https://${site.domain}`;
  // Reached through callposts.com/cd/... rather than the domain itself: keep it out of search results.
  const offDomain = url.hostname !== site.domain;
  const text = (body: string, type: string) => new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=300" } });

  if (rest === `${INDEXNOW_KEY}.txt`) return text(INDEXNOW_KEY, "text/plain");
  if (rest === "privacy") return html(privacyFor(site, "/"), { "x-robots-tag": "noindex" });
  if (rest === "robots.txt") return text(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, "text/plain");

  const pages = await sitePages(site);
  if (!pages.length) return notFound();
  if (rest === "sitemap.xml") {
    const locs = [`${base}/`, ...pages.map((p) => `${base}/${cityFile(p)}`)];
    return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l, i) => `  <url><loc>${l}</loc><priority>${i ? "0.8" : "1.0"}</priority></url>`).join("\n")}\n</urlset>\n`, "application/xml");
  }
  if (rest.startsWith("images/")) {
    const pg = pages.find((p) => rest === `images/${p.slug}`);
    if (!pg?.photo) return new Response("Not found", { status: 404 });
    const got = await getStore("page-images").getWithMetadata(pg.photo, { type: "arrayBuffer" });
    if (!got?.data) return new Response("Not found", { status: 404 });
    return new Response(got.data as ArrayBuffer, { headers: { "content-type": String(got.metadata?.type || "image/png"), "cache-control": "public, max-age=86400" } });
  }
  const img = (p?: LandingPage) => (p?.photo ? `${base}/images/${p.slug}` : undefined);
  const cityHref = (p: LandingPage) => `/${cityFile(p)}`;
  if (!rest || rest === "index.html") {
    if (!offDomain) { site.views = (site.views || 0) + 1; sitesStore().setJSON(site.slug, site).catch(() => {}); }
    return html(renderHub(site, pages, { base, selfHref: "/", cityHref, canonical: `${base}/`, photoUrl: img(pages.find((p) => p.photo)), noindex: offDomain, privacyHref: "/privacy" }));
  }
  const file = rest.replace(/\.html$/, "");
  const page = pages.find((p) => cityFile(p) === file);
  if (!page) return notFound();
  if (!offDomain) { page.views = (page.views || 0) + 1; pagesStore().setJSON(page.slug, page).catch(() => {}); }
  const nav: SiteNav = { hubName: `${site.service} in ${site.region}`, hubHref: "/", cities: pages.map((p) => ({ name: p.city, href: cityHref(p), current: p.slug === page.slug })) };
  return html(renderLanding(page, { base, photoUrl: img(page), site: nav, canonical: `${base}/${file}`, noindex: offDomain, privacyHref: "/privacy" }));
}

export const config: Config = { path: ["/p/:slug", "/p/:slug/privacy", "/p-img/:slug", "/s/:slug", "/s/:slug/privacy", "/s/:slug/site.zip", "/theme/:key", "/cd/*"], method: "GET" };
