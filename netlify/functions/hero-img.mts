import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { GoogleGenAI } from "@google/genai";

// Example photos for the landing page. Each one is generated once with the AI photo model,
// saved to Blobs, and served from there (and the CDN) after that. Only these fixed keys exist.
const PROMPTS: Record<string, string> = {
  "water-heater": "A technician in a plain navy work shirt and cap, seen from the side and slightly behind, kneeling to service a white residential tank water heater with copper pipes in a clean garage. Face turned away, not recognizable.",
  "central-ac": "A residential outdoor central air conditioner condenser unit beside a tan stucco house wall with desert landscaping, gravel and a small agave, late afternoon Arizona light.",
};

const RULES = "Realistic natural-looking photograph, true-to-life colors, sharp focus, square composition. No text, no words, no letters, no numbers, no signs, no logos, no brand names, no watermarks, no recognizable faces.";

export default async (_req: Request, context: Context) => {
  const name = String(context.params.name || "").replace(/\.jpg$|\.png$/, "");
  const prompt = PROMPTS[name];
  if (!prompt) return new Response("Not found", { status: 404 });

  const store = getStore("site-images");
  const cached = await store.getWithMetadata(name, { type: "arrayBuffer" });
  let data = cached?.data as ArrayBuffer | undefined;
  let type = String(cached?.metadata?.type || "image/png");

  if (!data) {
    try {
      const ai = new GoogleGenAI({});
      const res = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: `${prompt} ${RULES}`,
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      });
      const part = (res.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("no image returned");
      type = part.inlineData.mimeType || "image/png";
      const bytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));
      data = bytes.buffer;
      await store.set(name, data, { metadata: { type } });
      console.log(`hero image generated: ${name}`);
    } catch (e) {
      console.error("hero image failed", name, e);
      return new Response("Image unavailable", { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  return new Response(data, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400",
      "netlify-cdn-cache-control": "public, durable, s-maxage=31536000",
    },
  });
};

export const config: Config = { path: "/img/:name", method: "GET" };
