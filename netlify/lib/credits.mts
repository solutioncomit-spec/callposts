import { getStore } from "@netlify/blobs";

// Credit balances live in Netlify Blobs, one record per Identity user.
// Writes use the record's etag so two requests can't spend the same credits.

export type Account = {
  email: string;
  credits: number;
  created: string;
  spent: number;
  firstListingAt?: string;
  log: { t: string; d: number; why: string }[];
};

export const STARTER_CREDITS = () => Math.max(0, Number(Netlify.env.get("STARTER_CREDITS") ?? 15) || 0);

const store = () => getStore({ name: "accounts", consistency: "strong" });
const key = (userId: string) => `u/${userId}`;

export async function getAccount(userId: string, email = ""): Promise<Account> {
  const s = store();
  const got = await s.getWithMetadata(key(userId), { type: "json" });
  if (got?.data) return got.data as Account;
  const fresh: Account = {
    email, credits: STARTER_CREDITS(), created: new Date().toISOString(), spent: 0,
    log: [{ t: new Date().toISOString(), d: STARTER_CREDITS(), why: "starter credits" }],
  };
  const res = await s.setJSON(key(userId), fresh, { onlyIfNew: true });
  if (res.modified) return fresh;
  return ((await s.get(key(userId), { type: "json" })) as Account) || fresh;
}

// Adds (or with a negative delta, removes) credits. Returns the new account,
// or null when a spend would take the balance below zero.
export async function changeCredits(userId: string, email: string, delta: number, why: string): Promise<Account | null> {
  const s = store();
  await getAccount(userId, email);
  for (let attempt = 0; attempt < 6; attempt++) {
    const got = await s.getWithMetadata(key(userId), { type: "json" });
    if (!got?.data) continue;
    const acc = got.data as Account;
    if (delta < 0 && acc.credits + delta < 0) return null;
    const next: Account = {
      ...acc,
      email: acc.email || email,
      credits: acc.credits + delta,
      spent: acc.spent + (delta < 0 ? -delta : 0),
      log: [{ t: new Date().toISOString(), d: delta, why }, ...(acc.log || [])].slice(0, 50),
    };
    const res = await s.setJSON(key(userId), next, got.etag ? { onlyIfMatch: got.etag } : {});
    if (res.modified) return next;
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
  }
  throw new Error("Couldn't update credits, please try again.");
}

export async function listAccounts(): Promise<(Account & { id: string })[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: "u/" });
  const out: (Account & { id: string })[] = [];
  for (const b of blobs) {
    const a = (await s.get(b.key, { type: "json" })) as Account | null;
    if (a) out.push({ ...a, id: b.key.slice(2) });
  }
  return out;
}

// Marks an external event (like a payment) as handled so it is never counted twice.
export async function claimOnce(id: string): Promise<boolean> {
  const res = await getStore({ name: "events", consistency: "strong" }).set(id, new Date().toISOString(), { onlyIfNew: true });
  return res.modified;
}

// Records when an account wrote its first listings (activation metric). Safe to call repeatedly.
export async function markFirstListing(userId: string, email = ""): Promise<void> {
  const s = store();
  await getAccount(userId, email);
  for (let attempt = 0; attempt < 4; attempt++) {
    const got = await s.getWithMetadata(key(userId), { type: "json" });
    const acc = got?.data as Account | undefined;
    if (!acc || acc.firstListingAt) return;
    const res = await s.setJSON(key(userId), { ...acc, firstListingAt: new Date().toISOString() }, got?.etag ? { onlyIfMatch: got.etag } : {});
    if (res.modified) return;
  }
}
