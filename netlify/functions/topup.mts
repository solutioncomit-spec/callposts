import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { getStore } from "@netlify/blobs";
import { changeCredits, getAccount } from "../lib/credits.mts";
import { rewardReferrer } from "../lib/referrals.mts";
import { clean, isAdminEmail } from "../lib/access.mts";

// Manual top-ups: for paying by bank transfer, Payoneer or another method while there's no checkout.
//   GET  /api/topup                     → plans, how to pay (MANUAL_PAY env), and my requests
//   POST /api/topup { plan, method, reference, note }   → "I've paid" request, pending admin review
//   GET  /api/topup?all=1               (admin) → every request, newest first
//   POST /api/topup { action: "approve"|"reject", id }  (admin) → approve adds the plan's credits once
// Payment details are never stored in code: the admin puts instructions in the MANUAL_PAY env var.
const PLANS = [
  { id: "pack", name: "Credit pack", price: "$5", credits: 40, note: "one time" },
  { id: "starter", name: "Starter", price: "$9", credits: 100, note: "one month" },
  { id: "pro", name: "Pro", price: "$19", credits: 350, note: "one month" },
  { id: "agency", name: "Agency", price: "$49", credits: 1200, note: "one month" },
];
const METHODS = ["Payoneer", "Bank transfer (ACH or wire)", "Wise", "Other"];
const store = () => getStore({ name: "topups", consistency: "strong" });
type Req = { id: string; userId: string; email: string; plan: string; credits: number; price: string; method: string; reference: string; note: string; status: "pending" | "approved" | "rejected"; created: string; decided?: string; by?: string };

async function all(prefix = ""): Promise<Req[]> {
  const { blobs } = await store().list({ prefix });
  const items = await Promise.all(blobs.map((b) => store().get(b.key, { type: "json" }) as Promise<Req | null>));
  return (items.filter(Boolean) as Req[]).sort((a, b) => b.created.localeCompare(a.created));
}

export default async (req: Request) => {
  const me = await getUser();
  if (!me) return Response.json({ error: "Log in first.", needLogin: true }, { status: 401 });
  const admin = isAdminEmail(me.email);
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("all") && admin) return Response.json({ requests: (await all()).slice(0, 200) }, { headers: { "cache-control": "no-store" } });
    const mine = (await all(`u/${me.id}/`)).slice(0, 10).map(({ userId, by, ...r }) => r);
    return Response.json({
      plans: PLANS, methods: METHODS, support: "support@callposts.com",
      howToPay: Netlify.env.get("MANUAL_PAY") || "",
      requests: mine,
    }, { headers: { "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Use GET or POST." }, { status: 405 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  if (body.action === "approve" || body.action === "reject") {
    if (!admin) return Response.json({ error: "Admins only." }, { status: 403 });
    const id = clean(body.id, 120);
    const got = await store().getWithMetadata(id, { type: "json" });
    if (!got) return Response.json({ error: "Request not found." }, { status: 404 });
    const r = got.data as Req;
    if (r.status !== "pending") return Response.json({ error: `Already ${r.status}.` }, { status: 409 });
    const next: Req = { ...r, status: body.action === "approve" ? "approved" : "rejected", decided: new Date().toISOString(), by: me.email };
    // Mark it decided first (etag-guarded) so a double click can't add credits twice.
    const saved = await store().setJSON(id, next, { onlyIfMatch: got.etag });
    if (!saved.modified) return Response.json({ error: "Someone else just updated this request. Refresh." }, { status: 409 });
    if (next.status === "approved") {
      await getAccount(r.userId, r.email);
      const acc = await changeCredits(r.userId, r.email, r.credits, `purchase: manual ${r.plan} via ${r.method}${r.reference ? ` (${r.reference})` : ""}`);
      try { await rewardReferrer(r.userId, r.credits, `manual top-up ${r.id}`); } catch (e) { console.error("referral reward failed", e); }
      console.log(`topup approved ${id} +${r.credits} -> ${r.email} by ${me.email}`);
      return Response.json({ ok: true, status: next.status, credits: acc?.credits ?? null });
    }
    console.log(`topup rejected ${id} by ${me.email}`);
    return Response.json({ ok: true, status: next.status });
  }

  const plan = PLANS.find((p) => p.id === clean(body.plan, 20));
  if (!plan) return Response.json({ error: "Choose a plan." }, { status: 400 });
  const method = METHODS.includes(String(body.method)) ? String(body.method) : "Other";
  const reference = clean(body.reference, 120);
  if (!reference) return Response.json({ error: "Add the payment reference or transaction ID so we can match your payment." }, { status: 400 });
  const pending = (await all(`u/${me.id}/`)).filter((r) => r.status === "pending");
  if (pending.length >= 3) return Response.json({ error: "You have 3 requests waiting for review. We'll get to them soon." }, { status: 429 });
  const id = `u/${me.id}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`;
  const r: Req = { id, userId: me.id, email: me.email || "", plan: plan.id, credits: plan.credits, price: plan.price, method, reference, note: clean(body.note, 300), status: "pending", created: new Date().toISOString() };
  await store().setJSON(id, r);
  console.log(`topup requested ${id} ${plan.id} ${method} by ${me.email}`);
  return Response.json({ ok: true, id, status: "pending" });
};

export const config: Config = {
  path: "/api/topup",
  method: ["GET", "POST"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
