import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { markFirstListing } from "../lib/credits.mts";
import { clean } from "../lib/access.mts";

// Saved listing kits for logged-in users, so they can reopen past kits and note which ones brought calls.
// GET: list kits. POST: save a kit. PATCH: update a kit's result note.
type Kit = { id: string; t: string; service: string; city: string; angle: string; phone: string; brand: string; items: unknown[]; note: string };

const MAX_KITS = 40;
const store = () => getStore({ name: "history", consistency: "strong" });

export default async (req: Request) => {
  const user = await getUser();
  if (!user) return Response.json({ error: "Log in to see your history.", needLogin: true }, { status: 401 });
  const key = `h/${user.id}`;
  const s = store();
  const kits = ((await s.get(key, { type: "json" })) as Kit[] | null) || [];

  if (req.method === "GET") return Response.json({ kits }, { headers: { "cache-control": "no-store" } });

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }

  if (req.method === "POST") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 8) : [];
    if (!items.length) return Response.json({ error: "Nothing to save." }, { status: 400 });
    const raw = JSON.stringify(items);
    if (raw.length > 60000) return Response.json({ error: "Kit too large to save." }, { status: 413 });
    const kit: Kit = {
      id: crypto.randomUUID(), t: new Date().toISOString(),
      service: clean(body.service, 80), city: clean(body.city, 80), angle: clean(body.angle, 40),
      phone: clean(body.phone, 30), brand: clean(body.brand, 60), items, note: "",
    };
    await s.setJSON(key, [kit, ...kits].slice(0, MAX_KITS));
    await markFirstListing(user.id, user.email || "");
    return Response.json({ ok: true, id: kit.id });
  }

  if (req.method === "PATCH") {
    const id = clean(body.id, 60);
    const i = kits.findIndex((k) => k.id === id);
    if (i < 0) return Response.json({ error: "Kit not found." }, { status: 404 });
    kits[i] = { ...kits[i], note: clean(body.note, 200) };
    await s.setJSON(key, kits);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported method." }, { status: 405 });
};

export const config: Config = { path: "/api/history", method: ["GET", "POST", "PATCH"] };
