import { getStore } from "@netlify/blobs";

// Custom domains: when a request arrives on a connected customer domain, rewrite it to that city
// site's pages (/cd/<site>/...). Requests on callposts.com and *.netlify.app pass straight through.
const OWN = /(^|\.)callposts\.com$|\.netlify\.app$|^localhost$|^127\.0\.0\.1$/;
const cache = new Map<string, { site: string | null; t: number }>();

export default async (req: Request) => {
  const url = new URL(req.url);
  const host = url.hostname.toLowerCase();
  if (OWN.test(host)) return;

  let hit = cache.get(host);
  if (!hit || Date.now() - hit.t > 60_000) {
    let site: string | null = null;
    try { site = (await getStore("domains").get(host)) || null; } catch (e) { console.error("domain lookup failed", host, e); }
    hit = { site, t: Date.now() };
    cache.set(host, hit);
  }
  if (!hit.site) {
    return new Response("This domain isn't connected to a site yet.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new URL(`/cd/${hit.site}${url.pathname}`, req.url);
};

export const config = { path: "/*", excludedPath: ["/cd/*", "/.netlify/*"] };
