import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Sitemap: the main pages plus every hosted landing page, so Google can find them.
export default async (req: Request) => {
  const origin = new URL(req.url).origin;
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/app`, priority: "0.6" },
  ];
  try {
    const { blobs } = await getStore({ name: "pages", consistency: "strong" }).list();
    for (const b of blobs) if (/^[a-z0-9-]+$/.test(b.key)) urls.push({ loc: `${origin}/p/${b.key}`, priority: "0.8" });
  } catch (e) { console.error("sitemap list failed", e); }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
};

export const config: Config = { path: "/sitemap.xml", method: "GET" };
