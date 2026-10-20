import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { getAccount } from "../lib/credits.mts";
import { isAdminEmail } from "../lib/access.mts";
import { attribute, myReferral, WELCOME_BONUS, SHARE } from "../lib/referrals.mts";

// The logged-in user's credit balance, recent activity, and where to buy more.
export default async (req: Request) => {
  const user = await getUser();
  if (!user) return Response.json({ loggedIn: false }, { headers: { "cache-control": "no-store" } });
  let acc = await getAccount(user.id, user.email || "");
  // A friend's referral code, sent by the app from the ?ref= link they arrived with.
  const ref = req.headers.get("x-ref");
  let welcomed = false;
  if (ref) {
    try { welcomed = await attribute(user.id, user.email || "", acc, ref); if (welcomed) acc = await getAccount(user.id, user.email || ""); }
    catch (e) { console.error("referral attribution failed", e); }
  }
  let referral = null;
  try {
    const r = await myReferral(user.id, user.email || "");
    referral = { code: r.code, link: `${new URL(req.url).origin}/?ref=${r.code}`, signups: r.signups, paying: r.paying.length, earned: r.earned, bonus: WELCOME_BONUS, share: Math.round(SHARE * 100) };
  } catch (e) { console.error("referral code failed", e); }
  // Checkout links per plan, from CHECKOUT_LINKS (JSON {"starter":url,"pro":url,"agency":url,"pack":url}).
  // Each link is tagged with the user id so the payment webhook knows whose credits to add.
  let links: Record<string, string> = {};
  try { links = JSON.parse(Netlify.env.get("CHECKOUT_LINKS") || "{}"); } catch { console.error("CHECKOUT_LINKS is not valid JSON"); }
  const tag = (url: string) => {
    try {
      const u = new URL(url);
      if (user.email) u.searchParams.set("checkout[email]", user.email);
      u.searchParams.set("checkout[custom][user_id]", user.id);
      return u.toString();
    } catch { return ""; }
  };
  const plans = [
    { id: "starter", name: "Starter", price: "$9/mo", credits: "100 credits a month" },
    { id: "pro", name: "Pro", price: "$19/mo", credits: "350 credits a month" },
    { id: "agency", name: "Agency", price: "$49/mo", credits: "1,200 credits a month" },
    { id: "pack", name: "Credit pack", price: "$5 once", credits: "40 credits" },
  ].filter((p) => links[p.id]).map((p) => ({ ...p, url: tag(links[p.id]) })).filter((p) => p.url);
  const buyUrl = plans.length ? "/app#buy" : "";
  return Response.json(
    {
      loggedIn: true,
      email: user.email,
      credits: acc.credits,
      log: (acc.log || []).slice(0, 15),
      buyUrl,
      plans,
      admin: isAdminEmail(user.email),
      costs: { listing: 1, photo: 3, picks: 1 },
      referral,
      welcomed,
    },
    { headers: { "cache-control": "no-store" } },
  );
};

export const config: Config = { path: "/api/me", method: "GET" };
