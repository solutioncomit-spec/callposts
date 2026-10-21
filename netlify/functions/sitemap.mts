import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { siteLinks, siteServices, isMulti, type Site } from "../lib/landing.mts";

// Sitemap: the main pages plus every hosted landing page, so Google can find them.
export default async (req: Request) => {
  const origin = new URL(req.url).origin;
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/app`, priority: "0.6" },
    { loc: `${origin}/free-audit`, priority: "0.9" },
    { loc: `${origin}/networks`, priority: "0.8" },
    { loc: `${origin}/learn`, priority: "0.8" },
    ...["how", "niche", "build", "domain", "grow", "network"].map((id) => ({ loc: `${origin}/learn/${id}`, priority: "0.7" })),
    { loc: `${origin}/terms`, priority: "0.2" },
    { loc: `${origin}/privacy`, priority: "0.2" },
    { loc: `${origin}/refunds`, priority: "0.2" },
  ];
  try {
    const { blobs } = await getStore({ name: "pages", consistency: "strong" }).list();
    for (const b of blobs) if (/^[a-z0-9-]+$/.test(b.key)) urls.push({ loc: `${origin}/p/${b.key}`, priority: "0.8" });
  } catch (e) { console.error("sitemap list failed", e); }
  try {
    const { blobs } = await getStore({ name: "sites", consistency: "strong" }).list();
    const store = getStore({ name: "sites", consistency: "strong" });
    for (const b of blobs) {
      if (!/^[a-z0-9-]+$/.test(b.key)) continue;
      const site = (await store.get(b.key, { type: "json" })) as Site | null;
      // Sites on their own domain have their own sitemap there.
      if (!site || site.domain || !site.pages?.length) continue;
      const L = siteLinks(site, "hosted");
      urls.push({ loc: `${origin}${L.home}`, priority: "0.8" });
      if (isMulti(site)) {
        for (const v of siteServices(site)) urls.push({ loc: `${origin}${L.service(v)}`, priority: "0.7" });
        for (const c of site.cities) urls.push({ loc: `${origin}${L.area(c)}`, priority: "0.6" });
      }
      if (site.posts?.length) {
        urls.push({ loc: `${origin}${L.blogIndex}`, priority: "0.5" });
        for (const x of site.posts) urls.push({ loc: `${origin}${L.post(x.slug)}`, priority: "0.6" });
      }
    }
  } catch (e) { console.error("sitemap sites failed", e); }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
};

export const config: Config = { path: "/sitemap.xml", method: "GET" };
