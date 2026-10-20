import type { Config, Context } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { payFor, creditHeaders, clean } from "../lib/access.mts";
import { angleGuide } from "../lib/angles.mts";

// Writes Marketplace listings for one service + city.
// Access is gated by codes in the ACCESS_CODES env var (comma-separated).
// The reply streams plain text (a JSON array) so long batches don't hit the 60s limit.

const MODEL = "claude-sonnet-5-5";

type Brief = {
  service: string;
  city: string;
  phone?: string;
  brand?: string;
  angle?: string;
  count?: number;
  extra?: string;
};

function buildPrompt(b: Brief): string {
  const cityName = b.city.split(",")[0];
  return `You are a Facebook Marketplace copywriter for a US pay-per-call home-services referral business. Write ${b.count} DIFFERENT Marketplace listings that make homeowners call the phone number.

Service: ${b.service}
Market: ${b.city}
Phone (tracking number): ${b.phone || "[PHONE]"}
Brand/page name: ${b.brand || "(none, write without a brand)"}
Listing style: ${angleGuide(b.angle)}
Extra notes from the publisher: ${b.extra || "(none)"}

Rules:
- Honest referral service. Never claim to be a licensed/insured/bonded/certified contractor, never invent reviews, ratings, years in business, guarantees or warranties. Include one short line such as "We connect you with trusted local pros" in each description.
- These are service listings (Marketplace category "Home Services" or the closest fit). No fake products.
- Never use the word "free" in any form (free quote, free estimate, free inspection) and never say or imply any part of the service costs nothing.
- The Marketplace price field is always the placeholder "$1,111". Never mention any real service price, cost, rate, discount, percentage off, coupon or dollar figure anywhere in titles, descriptions or replies.
- Put the phone number in each description twice, written plainly (e.g. 555-123-4567). No links or web addresses, no emoji spam, no ALL CAPS.
- Each listing must use a different hook, title structure and opening line, so none are duplicates. Mention ${cityName} and 1-3 nearby neighborhoods or suburbs you are confident are real.
- Titles: max 90 characters, include the service and city. Descriptions: 80-160 words, short paragraphs, plain text.
- Write 2 short Messenger replies per listing for people who message instead of calling (e.g. "How much?" / "Are you available?"). Never quote a price; say pricing depends on the job and the fastest way to get an exact quote is to call the number.
- Give 3 photo ideas per listing the publisher can shoot or source legally (no stock watermarks, no other companies' logos).
- For each listing also write image text for a square ad creative: "headline" = the service in 2-5 words that fit on two short lines (e.g. "Water Heater Repair & Install"), and "tagline" = 3-6 words that match the listing's hook (e.g. "Same-day help from local pros"). No prices, no "free", no phone number in these two fields.

Reply with only a JSON array, no other text. Each item: {"title": string, "hook": string (2-4 word label of the style used), "category": string, "price": "$1,111", "description": string, "tags": [up to 6 short search tags], "photos": [3 strings], "replies": [2 strings], "headline": string, "tagline": string}`;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const brief: Brief = {
    service: clean(body.service, 80),
    city: clean(body.city, 80),
    phone: clean(body.phone, 30),
    brand: clean(body.brand, 60),
    angle: clean(body.angle, 40),
    extra: clean(body.extra, 400),
    count: Math.min(8, Math.max(1, Number(body.count) || 5)),
  };
  if (!brief.service || !brief.city) {
    return Response.json({ error: "Add a service and a city." }, { status: 400 });
  }

  if (!Netlify.env.get("ANTHROPIC_BASE_URL") && !Netlify.env.get("ANTHROPIC_API_KEY")) {
    return Response.json({ error: "The AI service isn't active on this site yet." }, { status: 503 });
  }

  // 1 credit per listing, charged up front and refunded if the AI call fails.
  const payer = await payFor(req, brief.count!, `${brief.count} listings: ${brief.service}, ${brief.city}`);
  if (!payer.ok) return payer.res;
  const who = payer.label;

  const anthropic = new Anthropic();
  const encoder = new TextEncoder();

  let live: { abort: () => void } | null = null;
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          messages: [{ role: "user", content: buildPrompt(brief) }],
        });
        live = s;
        s.on("text", (t) => { if (!cancelled) controller.enqueue(encoder.encode(t)); });
        await s.finalMessage();
        console.log(`generate ok who=${who} service="${brief.service}" city="${brief.city}" count=${brief.count}`);
      } catch (e) {
        if (!cancelled) {
          console.error("generate failed", e);
          await payer.refund();
          controller.enqueue(encoder.encode("\n[[ERROR]]"));
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
    // The user pressed Stop or closed the page: stop the AI call and give the credits back.
    async cancel() {
      cancelled = true;
      try { live?.abort(); } catch {}
      await payer.refund();
      console.log(`generate cancelled who=${who}, refunded`);
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...creditHeaders(payer) },
  });
};

export const config: Config = {
  path: "/api/generate",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
