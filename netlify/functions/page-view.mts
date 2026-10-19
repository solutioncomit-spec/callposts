import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { renderLanding, renderHub, samplePage, isTheme, type LandingPage, type Site, type SiteNav } from "../lib/landing.mts";
import { makeZip } from "../lib/zip.mts";

// Public pages:
//   /p/:slug            a hosted landing page        /p-img/:slug   its photo
//   /s/:slug            a city site's hub page       /s/:slug/site.zip  the whole site as a ZIP
//   /theme/:key         theme preview with sample copy
const pagesStore = () => getStore({ name: "pages", consistency: "strong" });
const sitesStore = () => getStore({ name: "sites", consistency: "strong" });
const html = (body: string, extra: Record<string, string> = {}) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...extra } });
const notFound = () => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font:16px system-ui;background:#0b0c10;color:#f4f4f5;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>This page isn't available</h1><p>It may have been removed by its owner.</p></div>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

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
      const cityHref = (p: LandingPage) => `${p.slug}.html`;
      const nav = (cur: LandingPage): SiteNav => ({ hubName: `${site.service} in ${site.region}`, hubHref: "index.html", cities: pages.map((p) => ({ name: p.city, href: cityHref(p), current: p.slug === cur.slug })) });
      files.unshift({ name: "index.html", data: renderHub(site, pages, { cityHref, selfHref: "index.html", photoUrl: withPhoto ? imgName.get(withPhoto.slug) : undefined }) });
      for (const p of pages) files.push({ name: cityHref(p), data: renderLanding(p, { photoUrl: imgName.get(p.slug), site: nav(p) }) });
      return new Response(makeZip(files), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${site.slug}.zip"`, "cache-control": "no-store" } });
    }

    if (url.searchParams.get("preview") !== "1") {
      site.views = (site.views || 0) + 1;
      sitesStore().setJSON(slug, site).catch(() => {});
    }
    return html(renderHub(site, pages, { base: origin, selfHref: `/s/${slug}`, cityHref: (p) => `/p/${p.slug}`, photoUrl: withPhoto ? `${origin}/p-img/${withPhoto.slug}` : undefined }));
  }

  const store = pagesStore();
  const page = (await store.get(slug, { type: "json" })) as LandingPage | null;
  if (!page) return notFound();

  // Best-effort view counter (skip the owner's own previews).
  if (url.searchParams.get("preview") !== "1" && url.searchParams.get("download") !== "1") {
    page.views = (page.views || 0) + 1;
    store.setJSON(slug, page).catch(() => {});
  }

  const photoUrl = page.photo ? `${origin}/p-img/${slug}` : undefined;
  // Downloaded copies go on the publisher's own domain, so they must not point Google back here.
  const download = url.searchParams.get("download") === "1";
  let site: SiteNav | undefined;
  if (page.site && !download) {
    const s = (await sitesStore().get(page.site, { type: "json" })) as Site | null;
    if (s) site = { hubName: `${s.service} in ${s.region}`, hubHref: `/s/${s.slug}`, cities: s.pages.map((x) => ({ name: x.city, href: `/p/${x.slug}`, current: x.slug === slug })) };
  }
  return html(renderLanding(page, { photoUrl, base: download ? undefined : origin, site }));
};

export const config: Config = { path: ["/p/:slug", "/p-img/:slug", "/s/:slug", "/s/:slug/site.zip", "/theme/:key"], method: "GET" };
