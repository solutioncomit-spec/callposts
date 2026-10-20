import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import {
  renderLanding, renderHub, renderPrivacy, samplePage, isTheme, siteServices, isMulti, siteLinks, comboNav,
  renderSiteHome, renderServicePage, renderAreaPage, renderBlogIndex, renderPost,
  type LandingPage, type Site, type SiteNav, type SiteLinks, type Post,
} from "../lib/landing.mts";
import { INDEXNOW_KEY } from "../lib/domains.mts";
import { makeZip } from "../lib/zip.mts";

// Public pages:
//   /p/:slug                 a hosted landing page (also a site's service-in-city page)   /p-img/:slug  its photo
//   /s/:slug                 a site's home page            /s/:slug/site.zip   the whole site as a ZIP
//   /s/:slug/service/:svc    a service across the site's cities (multi-service sites)
//   /s/:slug/area/:city      every service in one city (multi-service sites)
//   /s/:slug/blog[/:post]    the site's blog
//   /theme/:key              theme preview with a real sample page
//   /cd/:site/...            a site on its own custom domain (the domains edge function rewrites requests here)
// A real generated page used for the theme previews (copied into the templates store on first use).
const PREVIEW_SOURCE = "water-heater-repair-mesa-61c1a";
const pagesStore = () => getStore({ name: "pages", consistency: "strong" });
const sitesStore = () => getStore({ name: "sites", consistency: "strong" });
const postsStore = () => getStore({ name: "posts", consistency: "strong" });
const html = (body: string, extra: Record<string, string> = {}) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...extra } });
const notFound = () => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font:16px system-ui;background:#0b0c10;color:#f4f4f5;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>This page isn't available</h1><p>It may have been removed by its owner.</p></div>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

const pageBrand = (p: LandingPage) => p.brand || `${p.city.split(",")[0]} ${(p.copy.keyword || p.service).replace(/\b\w/g, (m) => m.toUpperCase())} Help`;
const siteBrand = (s: Site) => s.brand || (isMulti(s) ? `${s.region} Home Service Help` : `${s.region} ${s.service} Help`);
const privacyFor = (s: Site, homeHref: string) => renderPrivacy({ theme: s.theme, brand: siteBrand(s), phone: s.phone, homeHref, homeName: siteBrand(s) });

async function sitePages(site: Site): Promise<LandingPage[]> {
  const list = await Promise.all(site.pages.map((x) => pagesStore().get(x.slug, { type: "json" }) as Promise<LandingPage | null>));
  const svcs = siteServices(site);
  const so = (v: string) => { const i = svcs.indexOf(v); return i < 0 ? 99 : i; };
  const co = (c: string) => { const i = site.cities.indexOf(c); return i < 0 ? 999 : i; };
  return list.filter((p): p is LandingPage => !!p).sort((a, b) => so(a.service) - so(b.service) || co(a.city) - co(b.city));
}
const getPost = (site: Site, slug: string) => postsStore().get(`${site.slug}/${slug}`, { type: "json" }) as Promise<Post | null>;

// Every page of a site, with the path it has under the given links. Combos (service-in-city pages) included.
type Entry = { path: string; kind: "home" | "service" | "area" | "combo" | "blogIndex" | "post" | "privacy"; svc?: string; city?: string; page?: LandingPage; post?: string };
function entries(site: Site, pages: LandingPage[], L: SiteLinks): Entry[] {
  const out: Entry[] = [{ path: L.home, kind: "home" }, { path: L.privacy, kind: "privacy" }];
  for (const p of pages) out.push({ path: L.combo(p), kind: "combo", page: p });
  if (isMulti(site)) {
    for (const v of siteServices(site)) out.push({ path: L.service(v), kind: "service", svc: v });
    for (const c of site.cities) out.push({ path: L.area(c), kind: "area", city: c });
  }
  if (site.posts?.length) {
    out.push({ path: L.blogIndex, kind: "blogIndex" });
    for (const x of site.posts) out.push({ path: L.post(x.slug), kind: "post", post: x.slug });
  }
  return out;
}

// Renders one page of a site. base = absolute origin for canonical URLs (undefined in ZIPs).
async function renderEntry(site: Site, pages: LandingPage[], e: Entry, L: SiteLinks, o: { base?: string; canonical?: string; noindex?: boolean; img: (p?: LandingPage) => string | undefined }): Promise<string | null> {
  const photo = o.img(pages.find((p) => p.photo));
  const blog = (site.posts || []).slice(0, 6).map((x) => ({ name: x.title, href: L.post(x.slug) }));
  switch (e.kind) {
    case "home":
      return isMulti(site)
        ? renderSiteHome(site, pages, { L, canonical: o.canonical, noindex: o.noindex, photoUrl: photo })
        : renderHub(site, pages, { base: o.base, selfHref: L.home, cityHref: (p) => L.combo(p), photoUrl: photo, canonical: o.canonical, noindex: o.noindex, privacyHref: L.privacy, blog, blogIndex: blog.length ? L.blogIndex : undefined });
    case "service": return renderServicePage(site, pages, e.svc!, { L, canonical: o.canonical, noindex: o.noindex, photoUrl: o.img(pages.find((p) => p.service === e.svc && p.photo)) });
    case "area": return renderAreaPage(site, pages, e.city!, { L, canonical: o.canonical, noindex: o.noindex, photoUrl: o.img(pages.find((p) => p.city === e.city && p.photo)) });
    case "blogIndex": return renderBlogIndex(site, pages, { L, canonical: o.canonical, noindex: o.noindex });
    case "post": { const post = await getPost(site, e.post!); return post ? renderPost(site, pages, post, { L, canonical: o.canonical, noindex: o.noindex }) : null; }
    case "privacy": return privacyFor(site, L.home);
    case "combo": return renderLanding(e.page!, { base: o.base, photoUrl: o.img(e.page), site: comboNav(site, pages, e.page!, L), canonical: o.canonical, noindex: o.noindex, privacyHref: L.privacy });
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const origin = url.origin;

  if (path.startsWith("/theme/")) {
    const key = String(context.params.key || "");
    if (!isTheme(key)) return notFound();
    const nav: SiteNav = { hubName: "Water Heater Repair in Colorado", hubHref: "#", cities: [{ name: "Aurora, CO", href: "#", current: true }, { name: "Denver, CO", href: "#" }, { name: "Lakewood, CO", href: "#" }] };
    const photo = url.searchParams.get("photo") === "0" ? undefined : `${origin}/img/water-heater.jpg`;
    // Previews use a real, full-length generated page (kept as a copy in the templates store), so people see
    // what they'll actually get. Falls back to the short built-in sample.
    const tpl = getStore("templates");
    let real = (await tpl.get("preview-page", { type: "json" })) as LandingPage | null;
    if (!real) {
      real = (await pagesStore().get(PREVIEW_SOURCE, { type: "json" })) as LandingPage | null;
      if (real) await tpl.setJSON("preview-page", real);
    }
    const sample: LandingPage = real
      ? { ...real, slug: "preview", owner: "", template: key, phone: "(555) 123-4567", brand: "Mesa Water Heater Help", photo: "sample", site: undefined, variant: 0 }
      : samplePage(key);
    if (real) { nav.hubName = "Water Heater Repair in Arizona"; nav.cities = [{ name: "Mesa, AZ", href: "#", current: true }, { name: "Tempe, AZ", href: "#" }, { name: "Chandler, AZ", href: "#" }]; }
    return html(renderLanding(sample, { photoUrl: photo, site: nav }), { "x-robots-tag": "noindex", "cache-control": "public, max-age=600" });
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

    if (path.endsWith("/site.zip")) {
      // Self-contained copy for the publisher's own hosting: relative links, local images, no canonical back to us.
      const L = siteLinks(site, "zip");
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
      for (const e of entries(site, pages, L)) {
        const out = await renderEntry(site, pages, e, L, { img: (p) => (p ? imgName.get(p.slug) : undefined) });
        if (out) files.push({ name: e.path, data: out });
      }
      return new Response(makeZip(files), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${site.slug}.zip"`, "cache-control": "no-store" } });
    }

    const L = siteLinks(site, "hosted");
    const e = entries(site, pages, L).find((x) => x.kind !== "combo" && x.path === path);
    if (!e) return notFound();
    if (e.kind === "home" && url.searchParams.get("preview") !== "1") {
      site.views = (site.views || 0) + 1;
      sitesStore().setJSON(slug, site).catch(() => {});
    }
    // Once the site has its own domain, those URLs are the ones search engines should index.
    const D = site.domain ? siteLinks(site, "domain") : null;
    const twin = D ? entries(site, pages, D).find((x) => x.kind === e.kind && x.svc === e.svc && x.city === e.city && x.post === e.post) : null;
    const out = await renderEntry(site, pages, e, L, { base: origin, canonical: twin ? `https://${site.domain}${twin.path}` : `${origin}${path}`, img: (p) => (p?.photo ? `${origin}/p-img/${p.slug}` : undefined) });
    return out ? html(out) : notFound();
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
  if (page.site && !download) {
    const s = (await sitesStore().get(page.site, { type: "json" })) as Site | null;
    if (s) {
      const pages = await sitePages(s);
      const L = siteLinks(s, "hosted");
      const canonical = s.domain ? `https://${s.domain}${siteLinks(s, "domain").combo(page)}` : undefined;
      return html(renderLanding(page, { photoUrl, base: origin, site: comboNav(s, pages, page, L), canonical, privacyHref: L.privacy }));
    }
  }
  // A downloaded page keeps a full link to its hosted privacy policy.
  const privacyHref = download ? `${origin}/p/${slug}/privacy` : `/p/${slug}/privacy`;
  return html(renderLanding(page, { photoUrl, base: download ? undefined : origin, privacyHref }));
};

// A site served on its own domain: every page by its path, plus sitemap, robots and images.
async function customDomain(url: URL): Promise<Response> {
  const [, , siteSlug = "", ...restParts] = url.pathname.split("/");
  const rest = restParts.join("/").replace(/\/$/, "").replace(/\.html$/, "");
  if (!/^[a-z0-9-]+$/.test(siteSlug)) return notFound();
  const site = (await sitesStore().get(siteSlug, { type: "json" })) as Site | null;
  if (!site || !site.domain) return notFound();
  const base = `https://${site.domain}`;
  // Reached through callposts.com/cd/... rather than the domain itself: keep it out of search results.
  const offDomain = url.hostname !== site.domain;
  const text = (body: string, type: string) => new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "public, max-age=300" } });

  if (rest === INDEXNOW_KEY || rest === `${INDEXNOW_KEY}.txt`) return text(INDEXNOW_KEY, "text/plain");
  if (rest === "robots.txt") return text(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, "text/plain");

  const pages = await sitePages(site);
  if (!pages.length) return notFound();
  const L = siteLinks(site, "domain");
  const all = entries(site, pages, L);
  if (rest === "sitemap.xml") {
    const locs = all.filter((e) => e.kind !== "privacy").map((e) => `${base}${e.path}`);
    return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l, i) => `  <url><loc>${l}</loc><priority>${i ? "0.8" : "1.0"}</priority></url>`).join("\n")}\n</urlset>\n`, "application/xml");
  }
  if (rest.startsWith("images/")) {
    const pg = pages.find((p) => rest === `images/${p.slug}`);
    if (!pg?.photo) return new Response("Not found", { status: 404 });
    const got = await getStore("page-images").getWithMetadata(pg.photo, { type: "arrayBuffer" });
    if (!got?.data) return new Response("Not found", { status: 404 });
    return new Response(got.data as ArrayBuffer, { headers: { "content-type": String(got.metadata?.type || "image/png"), "cache-control": "public, max-age=86400" } });
  }
  const want = rest === "" || rest === "index" ? "/" : `/${rest}`;
  const e = all.find((x) => x.path === want);
  if (!e) return notFound();
  if (!offDomain) {
    if (e.kind === "home") { site.views = (site.views || 0) + 1; sitesStore().setJSON(site.slug, site).catch(() => {}); }
    if (e.kind === "combo" && e.page) { e.page.views = (e.page.views || 0) + 1; pagesStore().setJSON(e.page.slug, e.page).catch(() => {}); }
  }
  const out = await renderEntry(site, pages, e, L, { base, canonical: `${base}${e.path === "/" ? "/" : e.path}`, noindex: offDomain || e.kind === "privacy", img: (p) => (p?.photo ? `${base}/images/${p.slug}` : undefined) });
  return out ? html(out, e.kind === "privacy" ? { "x-robots-tag": "noindex" } : {}) : notFound();
}

export const config: Config = {
  path: ["/p/:slug", "/p/:slug/privacy", "/p-img/:slug", "/s/:slug", "/s/:slug/privacy", "/s/:slug/site.zip", "/s/:slug/service/:svc", "/s/:slug/area/:city", "/s/:slug/blog", "/s/:slug/blog/:post", "/theme/:key", "/cd/*"],
  method: "GET",
};
