import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { payFor, creditHeaders, clean, whoAmI } from "../lib/access.mts";
import { auditHtml, type AuditResult } from "../lib/audit.mts";
import { fetchSafe, readText } from "../lib/fetchsafe.mts";

// Site audit for any public web page.
//   POST /api/audit { url, keyword?, city? }  → runs the audit (1 credit), returns the report + an AI fix plan
//   GET  /api/audit                           → the caller's recent audits
//   GET  /api/audit?id=...                    → one saved report
const COST = 1;
const MODEL = "claude-sonnet-5-5";
const store = () => getStore({ name: "audits", consistency: "strong" });

async function fixPlan(r: AuditResult, keyword: string, city: string): Promise<string[]> {
  const failed = r.checks.filter((c) => !c.ok);
  if (!failed.length) return ["Everything we check passed. Keep adding useful local content and earning links from local sites."];
  const anthropic = new Anthropic();
  const prompt = `You are a local SEO and pay-per-call conversion consultant. A home-services lead generation page was audited.
URL: ${r.finalUrl}
Page title: ${r.title || "(none)"}
Target service: ${keyword || "(not given)"} · Target city: ${city || "(not given)"}
Overall score: ${r.score}/100
Failed checks (name — what we found — standard fix):
${failed.map((c) => `- ${c.name} — ${c.found} — ${c.tip}`).join("\n")}

Write the 3 to 6 most important fixes, most impactful first, as a JSON array of strings. Each item: one or two plain sentences saying exactly what to change on this page and why it matters for rankings or calls. Be specific to what was found. Don't invent facts about the site beyond the list; if no target service or city was given, that only means the user didn't type one, not that the page lacks it. Never recommend using the word "free" or showing prices. Reply with only the JSON array.`;
  const msg = await anthropic.messages.stream({ model: MODEL, max_tokens: 1200, thinking: { type: "between_tools" } as any, messages: [{ role: "user", content: prompt }] }).finalMessage();
  const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
  return (Array.isArray(arr) ? arr : []).map((x) => clean(x, 400)).filter(Boolean).slice(0, 6);
}

export default async (req: Request) => {
  const owner = await whoAmI(req);
  if (!owner) return Response.json({ error: "Log in or add an access code to run audits.", needLogin: true }, { status: 401 });
  const prefix = `o/${owner}/`;

  if (req.method === "GET") {
    const id = clean(new URL(req.url).searchParams.get("id"), 60);
    if (id) {
      const one = await store().get(`${prefix}${id}`, { type: "json" });
      return one ? Response.json({ audit: one }, { headers: { "cache-control": "no-store" } }) : Response.json({ error: "Audit not found." }, { status: 404 });
    }
    const { blobs } = await store().list({ prefix });
    const keys = blobs.map((b) => b.key).sort().reverse().slice(0, 15);
    const list = (await Promise.all(keys.map((k) => store().get(k, { type: "json" }) as Promise<any>))).filter(Boolean)
      .map((a) => ({ id: a.id, url: a.report.finalUrl, score: a.report.score, at: a.at, keyword: a.keyword, city: a.city }));
    return Response.json({ audits: list }, { headers: { "cache-control": "no-store" } });
  }
  if (req.method !== "POST") return Response.json({ error: "Unsupported method." }, { status: 405 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Request body must be JSON." }, { status: 400 }); }
  let raw = clean(body.url, 500);
  if (!raw) return Response.json({ error: "Enter a website address to audit." }, { status: 400 });
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let start: URL;
  try { start = new URL(raw); } catch { return Response.json({ error: "That doesn't look like a web address." }, { status: 400 }); }
  const keyword = clean(body.keyword, 80);
  const city = clean(body.city, 80);

  const payer = await payFor(req, COST, `site audit: ${start.host}`);
  if (!payer.ok) return payer.res;

  // Keep the connection alive while the site is fetched and the fix plan is written.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const tick = setInterval(() => { try { controller.enqueue(enc.encode(" ")); } catch {} }, 4000);
      const finish = (obj: unknown) => { clearInterval(tick); controller.enqueue(enc.encode(JSON.stringify(obj))); controller.close(); };
      try {
        const got = await fetchSafe(start.toString());
        if ("error" in got) { await payer.refund(); return finish({ ok: false, error: got.error }); }
        const type = got.res.headers.get("content-type") || "";
        if (!/html|text\/plain/i.test(type)) { await payer.refund(); return finish({ ok: false, error: "That address isn't a web page." }); }
        const html = await readText(got.res);
        const origin = new URL(got.finalUrl).origin;
        const side = async (path: string) => {
          const r = await fetchSafe(`${origin}${path}`, 6000);
          if ("error" in r || r.res.status !== 200) return null;
          return (await readText(r.res)).slice(0, 200_000);
        };
        const [robots, sitemapTxt] = await Promise.all([side("/robots.txt"), side("/sitemap.xml")]);
        const report = auditHtml({ html, url: start.toString(), finalUrl: got.finalUrl, status: got.res.status, ms: got.ms, robots, sitemap: !!sitemapTxt && /<(urlset|sitemapindex)/i.test(sitemapTxt), keyword, city });
        let fixes: string[] = [];
        try { fixes = await fixPlan(report, keyword, city); } catch (e) { console.error("audit fix plan failed", e); }
        const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`;
        const saved = { id, at: new Date().toISOString(), keyword, city, report, fixes };
        await store().setJSON(`${prefix}${id}`, saved);
        console.log(`audit ${got.finalUrl} score=${report.score} owner=${owner}`);
        finish({ ok: true, ...saved, credits: payer.credits });
      } catch (e) {
        console.error("audit failed", e);
        await payer.refund();
        finish({ ok: false, error: "The audit didn't finish. Your credit was returned; try again." });
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...creditHeaders(payer) } });
};

export const config: Config = {
  path: "/api/audit",
  method: ["GET", "POST"],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
