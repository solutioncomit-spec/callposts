import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { renderLanding, type LandingPage } from "../lib/landing.mts";

// Serves hosted landing pages at /p/:slug and their photos at /p-img/:slug.
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const slug = String(context.params.slug || "").slice(0, 80);
  if (!/^[a-z0-9-]+$/.test(slug)) return new Response("Not found", { status: 404 });

  if (url.pathname.startsWith("/p-img/")) {
    const got = await getStore("page-images").getWithMetadata(`img/${slug}`, { type: "arrayBuffer" });
    if (!got?.data) return new Response("Not found", { status: 404 });
    return new Response(got.data as ArrayBuffer, { headers: { "content-type": String(got.metadata?.type || "image/png"), "cache-control": "public, max-age=86400" } });
  }

  const store = getStore({ name: "pages", consistency: "strong" });
  const page = (await store.get(slug, { type: "json" })) as LandingPage | null;
  if (!page) {
    return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font:16px system-ui;background:#0b0c10;color:#f4f4f5;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1>This page isn't available</h1><p>It may have been removed by its owner.</p></div>`, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // Best-effort view counter (skip the owner's own previews).
  if (url.searchParams.get("preview") !== "1" && url.searchParams.get("download") !== "1") {
    page.views = (page.views || 0) + 1;
    store.setJSON(slug, page).catch(() => {});
  }

  const photoUrl = page.photo ? `${url.origin}/p-img/${slug}` : undefined;
  // Downloaded copies go on the publisher's own domain, so they must not point Google back here.
  const download = url.searchParams.get("download") === "1";
  return new Response(renderLanding(page, { photoUrl, base: download ? undefined : url.origin }), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
};

export const config: Config = { path: ["/p/:slug", "/p-img/:slug"], method: "GET" };
