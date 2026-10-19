import type { Config } from "@netlify/functions";
import { getUser, admin, requestPasswordRecovery } from "@netlify/identity";
import { changeCredits, getAccount, listAccounts } from "../lib/credits.mts";
import { clean, isAdminEmail } from "../lib/access.mts";

// Admin-only: see every account and add or remove credits by email.
// Admins are the emails listed in the ADMIN_EMAILS env var.
export default async (req: Request) => {
  const me = await getUser();
  if (!me) return Response.json({ error: "Log in first." }, { status: 401 });
  if (!isAdminEmail(me.email)) return Response.json({ error: "This page is for CallPosts admins only." }, { status: 403 });

  if (req.method === "GET") {
    const accounts = await listAccounts();
    let users: { id: string; email?: string; confirmedAt?: string; createdAt?: string }[] = [];
    try { users = (await admin.listUsers({ perPage: 500 } as any)) as any; } catch (e) { console.error("listUsers failed", e); }
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const rows = users.map((u) => {
      const a = byId.get(u.id);
      return { id: u.id, email: u.email, confirmed: !!u.confirmedAt, created: u.createdAt, credits: a?.credits ?? null, spent: a?.spent ?? 0, last: a?.log?.[0] ?? null, firstListingAt: a?.firstListingAt ?? null, paid: !!a?.log?.some((l) => /^(purchase|renewal)/.test(l.why)) };
    });
    for (const a of accounts) if (!users.find((u) => u.id === a.id)) rows.push({ id: a.id, email: a.email, confirmed: true, created: a.created, credits: a.credits, spent: a.spent, last: a.log?.[0] ?? null, firstListingAt: a.firstListingAt ?? null, paid: !!a.log?.some((l) => /^(purchase|renewal)/.test(l.why)) });
    rows.sort((x, y) => String(y.created).localeCompare(String(x.created)));
    return Response.json({ rows }, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

    // Create a login for someone (e.g. an early-access request). The account is confirmed right away
    // with a random password, then they get a "set your password" email (the password-reset email).
    if (body.action === "create") {
      const email = clean(body.email, 200).toLowerCase();
      const name = clean(body.name, 80);
      const extra = Math.max(0, Math.min(10000, Math.trunc(Number(body.credits) || 0)));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });
      let existing: { id: string; email?: string }[] = [];
      try { existing = (await admin.listUsers({ perPage: 500 } as any)) as any; } catch (e) { console.error("listUsers failed", e); }
      if (existing.some((u) => (u.email || "").toLowerCase() === email)) return Response.json({ error: "That email already has an account." }, { status: 409 });
      const tmp = crypto.randomUUID() + crypto.randomUUID();
      let user;
      try {
        user = await admin.createUser({ email, password: tmp, data: name ? { user_metadata: { full_name: name } } : undefined });
      } catch (e) {
        console.error("createUser failed", e);
        return Response.json({ error: "Couldn't create the login. Check that Identity is enabled." }, { status: 502 });
      }
      await getAccount(user.id, email);
      if (extra) await changeCredits(user.id, email, extra, `welcome credits (by ${me.email})`);
      let emailed = true;
      try { await requestPasswordRecovery(email); } catch (e) { emailed = false; console.error("recovery email failed", e); }
      console.log(`admin created login ${email} by ${me.email} extra=${extra} emailed=${emailed}`);
      return Response.json({ ok: true, email, emailed });
    }
    const email = clean(body.email, 200).toLowerCase();
    const delta = Math.trunc(Number(body.credits));
    const note = clean(body.note, 120) || "admin adjustment";
    if (!email || !delta || Math.abs(delta) > 100000) return Response.json({ error: "Give an email and a whole number of credits." }, { status: 400 });

    let users: { id: string; email?: string }[] = [];
    try { users = (await admin.listUsers({ perPage: 500 } as any)) as any; } catch (e) { console.error("listUsers failed", e); }
    const target = users.find((u) => (u.email || "").toLowerCase() === email);
    if (!target) return Response.json({ error: "No account with that email yet. Ask them to sign up first." }, { status: 404 });
    await getAccount(target.id, target.email || email);
    const acc = await changeCredits(target.id, target.email || email, delta, `${note} (by ${me.email})`);
    if (!acc) return Response.json({ error: "That would take their balance below zero." }, { status: 400 });
    console.log(`admin credits ${delta} -> ${email} by ${me.email}`);
    return Response.json({ ok: true, email, credits: acc.credits });
  }

  return Response.json({ error: "Use GET or POST." }, { status: 405 });
};

export const config: Config = { path: "/api/admin", method: ["GET", "POST"] };
