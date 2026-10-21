import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { clean, whoAmI } from "../lib/access.mts";
import { auditHtml } from "../lib/audit.mts";
import { fetchSafe, readText } from "../lib/fetchsafe.mts";

// Quick check: the same ~31 rule-based audit checks with no AI fix list, at no charge.
//   POST /api/free-audit { url, keyword?, city? }
// Anyone can run 3 a day (per network address); logged-in users get 10 a day. The full audit with
// the AI fix list stays at 1 credit in the app.
const ANON_PER_DAY = 3;
const USER_PER_DAY = 10;
const limits = () => getStore({ name: "free-audit", consistency: "strong" });

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Count one use for today; returns how many are left, or -1 if the limit is already reached.
async function take(key: string, max: number): Promise<number> {
  for (let i = 0; i < 5; i++) {
    const got = await limits().getWithMetadata(key, { type: "json" });
    const n = got ? Number((got.data as any)?.n || 0) : 0;
    if (n >= max) return -1;
    const res = got ? await limits().setJSON(key, { n: n + 1 }, { onlyIfMatch: got.etag }) : await limits().setJSON(key, { n: 1 }, { onlyIfNew: true });
    if (res.modified) return max - n - 1;
  }
  return -1;
}

async function giveBack(key: string) {
  for (let i = 0; i < 5; i++) {
    const got = await limits().getWithMetadata(key, { type: "json" });
    if (!got) return;
    const n = Math.max(0, Number((got.data as any)?.n || 0) - 1);
    if ((await limits().setJSON(key, { n }, { onlyIfMatch: got.etag })).modified) return;
  }
}

export default async (req: Request, context: Context) => {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  let raw = clean(body.url, 500);
  if (!raw) return Response.json({ error: "Enter a website address to check." }, { status: 400 });
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let start: URL;
  try { start = new URL(raw); } catch { return Response.json({ error: "That doesn't look like a web address." }, { status: 400 }); }
  const keyword = clean(body.keyword, 80);
  const city = clean(body.city, 80);

  const owner = await whoAmI(req).catch(() => null);
  const day = new Date().toISOString().slice(0, 10);
  const who = owner ? `u-${await sha(owner)}` : `ip-${await sha(context.ip || req.headers.get("x-nf-client-connection-ip") || "unknown")}`;
  const max = owner ? USER_PER_DAY : ANON_PER_DAY;
  const key = `${day}/${who}`;
  const left = await take(key, max);
  if (left < 0) {
    return Response.json({
      error: owner
        ? `You've used today's ${max} quick checks. Run the full audit (1 credit) or come back tomorrow.`
        : `You've used today's ${max} quick checks. Create an account for 10 a day plus 15 starter credits for the full audit.`,
      limit: true,
    }, { status: 429 });
  }

  try {
    const got = await fetchSafe(start.toString());
    if ("error" in got) { await giveBack(key); return Response.json({ error: got.error }, { status: 400 }); }
    const type = got.res.headers.get("content-type") || "";
    if (!/html|text\/plain/i.test(type)) { await giveBack(key); return Response.json({ error: "That address isn't a web page." }, { status: 400 }); }
    const html = await readText(got.res);
    const origin = new URL(got.finalUrl).origin;
    const side = async (path: string) => {
      const r = await fetchSafe(`${origin}${path}`, 6000);
      if ("error" in r || r.res.status !== 200) return null;
      return (await readText(r.res)).slice(0, 200_000);
    };
    const [robots, sitemapTxt] = await Promise.all([side("/robots.txt"), side("/sitemap.xml")]);
    const report = auditHtml({ html, url: start.toString(), finalUrl: got.finalUrl, status: got.res.status, ms: got.ms, robots, sitemap: !!sitemapTxt && /<(urlset|sitemapindex)/i.test(sitemapTxt), keyword, city });
    console.log(`free audit ${got.finalUrl} score=${report.score} ${owner ? "user" : "anon"}`);
    return Response.json({ ok: true, at: new Date().toISOString(), keyword, city, report, fixes: [], left, quick: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("free audit failed", e);
    await giveBack(key);
    return Response.json({ error: "The check didn't finish. Try again." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/free-audit",
  method: ["POST"],
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
