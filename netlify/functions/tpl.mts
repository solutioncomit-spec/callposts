import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Serves template preview images for the in-app gallery.
export default async (req: Request, context: Context) => {
  const key = String(context.params.key || "");
  if (!/^[a-z]+-[12]\.jpg$/.test(key)) return new Response("Not found", { status: 404 });
  const data = await getStore("templates").get(key, { type: "arrayBuffer" });
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=3600",
      "netlify-cdn-cache-control": "public, durable, s-maxage=604800",
    },
  });
};

export const config: Config = { path: "/tpl/:key", method: "GET" };
