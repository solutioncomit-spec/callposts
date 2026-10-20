import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { changeCredits, claimOnce } from "../lib/credits.mts";
import { rewardReferrer } from "../lib/referrals.mts";

// Lemon Squeezy webhook: adds credits when someone pays.
//  - order_created (paid): first payment of any plan or a one-time credit pack
//  - subscription_created: remembers which user and plan a subscription belongs to
//  - subscription_payment_success with billing_reason "renewal": monthly top-up
// Stays switched off until these env vars are set:
//   LEMONSQUEEZY_WEBHOOK_SECRET  signing secret from the Lemon Squeezy webhook
//   CREDIT_PACKS                 JSON map of variant id -> credits, e.g. {"123456":100,"123457":350}
// Checkout links carry checkout[custom][user_id], which comes back as meta.custom_data.user_id.

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function packs(): Record<string, number> {
  try { return JSON.parse(Netlify.env.get("CREDIT_PACKS") || "{}"); } catch { console.error("CREDIT_PACKS is not valid JSON"); return {}; }
}

const subs = () => getStore({ name: "subscriptions", consistency: "strong" });

export default async (req: Request) => {
  const secret = Netlify.env.get("LEMONSQUEEZY_WEBHOOK_SECRET") || "";
  if (!secret) return Response.json({ error: "Payments aren't set up yet." }, { status: 503 });

  const raw = await req.text();
  const sig = (req.headers.get("x-signature") || "").trim().toLowerCase();
  if (!sig || !safeEqual(await hmacHex(secret, raw), sig)) return Response.json({ error: "Bad signature." }, { status: 401 });

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return Response.json({ error: "Bad JSON." }, { status: 400 }); }
  const name = evt?.meta?.event_name;
  const data = evt?.data;
  const attrs = data?.attributes || {};
  const custom = evt?.meta?.custom_data || {};

  if (name === "subscription_created") {
    await subs().setJSON(String(data.id), {
      userId: String(custom.user_id || ""), variantId: String(attrs.variant_id || ""), email: String(attrs.user_email || ""),
    });
    return Response.json({ ok: true, saved: data.id });
  }

  if (name === "order_created") {
    if (attrs.status !== "paid") return Response.json({ ok: true, ignored: `status ${attrs.status}` });
    const userId = String(custom.user_id || "");
    const variantId = String(attrs.first_order_item?.variant_id || "");
    const credits = Math.trunc(Number(packs()[variantId] || 0));
    if (!userId || !credits) {
      console.error(`payment needs manual review: order=${data?.id} variant=${variantId} user=${userId} email=${attrs.user_email}`);
      return Response.json({ ok: true, review: true });
    }
    if (!(await claimOnce(`ls-order-${data.id}`))) return Response.json({ ok: true, duplicate: true });
    const acc = await changeCredits(userId, String(attrs.user_email || ""), credits, `purchase: order ${data.id}`);
    console.log(`payment credited ${credits} to ${userId} order=${data.id} balance=${acc?.credits}`);
    try { await rewardReferrer(userId, credits, `order ${data.id}`); } catch (e) { console.error("referral reward failed", e); }
    return Response.json({ ok: true, credited: credits });
  }

  if (name === "subscription_payment_success") {
    // The first payment is already credited by order_created; only top up on renewals.
    if (attrs.billing_reason !== "renewal") return Response.json({ ok: true, ignored: `billing_reason ${attrs.billing_reason}` });
    const subId = String(attrs.subscription_id || "");
    const sub = (await subs().get(subId, { type: "json" })) as { userId: string; variantId: string; email: string } | null;
    const userId = String(custom.user_id || sub?.userId || "");
    const credits = Math.trunc(Number(packs()[sub?.variantId || ""] || 0));
    if (!userId || !credits) {
      console.error(`renewal needs manual review: invoice=${data?.id} sub=${subId} user=${userId} email=${attrs.user_email}`);
      return Response.json({ ok: true, review: true });
    }
    if (!(await claimOnce(`ls-invoice-${data.id}`))) return Response.json({ ok: true, duplicate: true });
    const acc = await changeCredits(userId, String(attrs.user_email || sub?.email || ""), credits, `renewal: subscription ${subId}`);
    console.log(`renewal credited ${credits} to ${userId} sub=${subId} balance=${acc?.credits}`);
    try { await rewardReferrer(userId, credits, `renewal ${subId}`); } catch (e) { console.error("referral reward failed", e); }
    return Response.json({ ok: true, credited: credits });
  }

  return Response.json({ ok: true, ignored: name });
};

export const config: Config = { path: "/api/payments/lemonsqueezy", method: "POST" };
