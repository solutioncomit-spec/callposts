import type { Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
import { payFor, creditHeaders, clean } from "../lib/access.mts";

const COST = 3;

// Makes one square, photo-real image for a Marketplace listing creative.
// Tries the fast image model first, then falls back to an older one.
const MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

function buildPrompt(service: string, city: string, idea: string, style: string): string {
  return `A realistic, natural-looking photograph for a local home-services ad.
Subject: ${service} at a typical home in or around ${city}. ${idea ? `Scene idea: ${idea}.` : ""}
Look: ${style === "dark" ? "moody evening or dusk light, rich contrast" : "bright, clean daylight"}, shot on a full-frame camera, true-to-life colors, sharp focus, square composition with the main subject slightly right of center and calm space on the left.
Strict rules: no text, no words, no letters, no numbers, no signs, no logos, no brand names, no watermarks, no company vehicles with lettering, no price tags, no recognizable real people's faces. Keep it believable, not illustrated or cartoonish.`;
}

export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  const service = clean(body.service, 80);
  const city = clean(body.city, 80);
  const idea = clean(body.idea, 240);
  const style = body.style === "dark" ? "dark" : "light";
  if (!service || !city) return Response.json({ error: "Add a service and a city." }, { status: 400 });

  if (!Netlify.env.get("GOOGLE_GEMINI_BASE_URL") && !Netlify.env.get("GEMINI_API_KEY")) {
    return Response.json({ error: "The AI photo service isn't active on this site yet." }, { status: 503 });
  }

  const payer = await payFor(req, COST, `AI photo: ${service}, ${city}`);
  if (!payer.ok) return payer.res;

  const ai = new GoogleGenAI({});
  const prompt = buildPrompt(service, city, idea, style);
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      });
      const parts = res.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => p.inlineData?.data);
      if (img?.inlineData?.data) {
        console.log(`photo ok who=${payer.label} model=${model} service="${service}" city="${city}"`);
        return Response.json(
          { image: `data:${img.inlineData.mimeType || "image/png"};base64,${img.inlineData.data}`, model },
          { headers: { "cache-control": "no-store", ...creditHeaders(payer) } },
        );
      }
      lastErr = new Error(`no image from ${model}`);
    } catch (e) {
      lastErr = e;
      console.error(`photo failed model=${model}`, e);
    }
  }
  console.error("photo gave up", lastErr);
  await payer.refund();
  return Response.json({ error: "The photo didn't come through. Try again in a moment." }, { status: 502 });
};

export const config: Config = {
  path: "/api/photo",
  method: "POST",
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
