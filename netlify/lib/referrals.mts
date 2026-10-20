// Referral program.
// - Every account gets a code and a link (callposts.com/?ref=CODE).
// - A friend who signs up through it gets WELCOME_BONUS extra credits.
// - Every time that friend pays, the referrer gets SHARE of the credits the payment added, for as long as they keep paying.
import { getStore } from "@netlify/blobs";
import { changeCredits, type Account } from "./credits.mts";

export const WELCOME_BONUS = 10;
export const SHARE = 0.3;
const ATTRIBUTION_WINDOW_MS = 48 * 60 * 60 * 1000; // only brand-new accounts can be attributed

const store = () => getStore({ name: "referrals", consistency: "strong" });
type Owner = { userId: string; email: string };
type Stats = { code: string; userId: string; email: string; signups: number; paying: string[]; earned: number };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("");
export const cleanCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

async function updateStats(userId: string, fn: (s: Stats) => void) {
  for (let i = 0; i < 6; i++) {
    const got = await store().getWithMetadata(`user/${userId}`, { type: "json" });
    if (!got?.data) return;
    const s = got.data as Stats;
    fn(s);
    const res = await store().setJSON(`user/${userId}`, s, { onlyIfMatch: got.etag });
    if (res.modified) return;
  }
}

// The account's own code, created on first use.
export async function myReferral(userId: string, email: string): Promise<Stats> {
  const have = (await store().get(`user/${userId}`, { type: "json" })) as Stats | null;
  if (have) return have;
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    const claimed = await store().setJSON(`code/${code}`, { userId, email } satisfies Owner, { onlyIfNew: true });
    if (!claimed.modified) continue;
    const stats: Stats = { code, userId, email, signups: 0, paying: [], earned: 0 };
    const res = await store().setJSON(`user/${userId}`, stats, { onlyIfNew: true });
    if (res.modified) return stats;
    await store().delete(`code/${code}`); // another request created one first
    return ((await store().get(`user/${userId}`, { type: "json" })) as Stats) || stats;
  }
  throw new Error("couldn't create a referral code");
}

// Link a brand-new account to whoever referred it, once. Returns true when the welcome bonus was given.
export async function attribute(userId: string, email: string, acc: Account, rawCode: unknown): Promise<boolean> {
  const code = cleanCode(rawCode);
  if (!code) return false;
  if (Date.now() - Date.parse(acc.created) > ATTRIBUTION_WINDOW_MS) return false;
  const owner = (await store().get(`code/${code}`, { type: "json" })) as Owner | null;
  if (!owner || owner.userId === userId) return false;
  if (owner.email && email && owner.email.toLowerCase() === email.toLowerCase()) return false;
  const res = await store().setJSON(`by/${userId}`, { referrer: owner.userId, referrerEmail: owner.email, code, at: new Date().toISOString() }, { onlyIfNew: true });
  if (!res.modified) return false;
  await changeCredits(userId, email, WELCOME_BONUS, `referral welcome bonus (code ${code})`);
  await updateStats(owner.userId, (s) => { s.signups += 1; });
  console.log(`referral signup ${userId} via ${code}`);
  return true;
}

// Called after a payment adds credits to a user: pays the referrer their share.
export async function rewardReferrer(userId: string, creditsBought: number, why: string) {
  if (!(creditsBought > 0)) return;
  const by = (await store().get(`by/${userId}`, { type: "json" })) as { referrer: string; referrerEmail: string } | null;
  if (!by) return;
  const bonus = Math.round(creditsBought * SHARE);
  if (bonus <= 0) return;
  await changeCredits(by.referrer, by.referrerEmail || "", bonus, `referral reward: ${why}`);
  await updateStats(by.referrer, (s) => { s.earned += bonus; if (!s.paying.includes(userId)) s.paying.push(userId); });
  console.log(`referral reward ${bonus} credits to ${by.referrer} for ${userId}`);
}
