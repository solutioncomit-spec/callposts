// Custom domains for city sites, and search engine submission (IndexNow).
import { getStore } from "@netlify/blobs";

// IndexNow key. It's public by design: search engines fetch /<key>.txt to confirm we own the host.
export const INDEXNOW_KEY = "4b1dba6cb862158d6b4cda866b4abd4b";

// Netlify's load balancer address for apex domains, and the site's own hostname for CNAMEs.
export const NETLIFY_APEX_IP = "75.2.60.5";
export const NETLIFY_HOST = "callposts.netlify.app";

export const domainsStore = () => getStore({ name: "domains", consistency: "strong" });

export function cleanHost(v: unknown): string | null {
  let h = String(v ?? "").trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h)) return null;
  if (/(^|\.)(callposts\.com|netlify\.app|netlify\.com)$/.test(h)) return null;
  return h;
}

async function doh(name: string, type: "A" | "CNAME"): Promise<string[]> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
    const j: any = await r.json();
    return (j.Answer || []).map((a: any) => String(a.data || "").replace(/\.$/, "").toLowerCase());
  } catch { return []; }
}

// Is the domain pointed at us? Accepts a CNAME to callposts.netlify.app (subdomains) or an A record to Netlify (apex).
export async function checkDns(host: string): Promise<{ ok: boolean; found: string[] }> {
  const [cname, a] = await Promise.all([doh(host, "CNAME"), doh(host, "A")]);
  const ok = cname.some((c) => c === NETLIFY_HOST || c.endsWith(".netlify.app")) || a.includes(NETLIFY_APEX_IP);
  return { ok, found: [...cname.map((c) => `CNAME ${c}`), ...a.map((x) => `A ${x}`)] };
}

const API = "https://api.netlify.com/api/v1";
function siteId(): string { return Netlify.env.get("SITE_ID") || "d6787d62-7ef0-40a9-adf8-3b646a70aea5"; }
export function domainsEnabled(): boolean { return !!Netlify.env.get("NETLIFY_API_TOKEN"); }

async function api(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${Netlify.env.get("NETLIFY_API_TOKEN")}`, "content-type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`Netlify API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

// Add or remove a hostname on the callposts site so Netlify serves it (and issues an HTTPS certificate).
export async function setAlias(host: string, add: boolean) {
  const site: any = await api(`/sites/${siteId()}`);
  const now: string[] = site.domain_aliases || [];
  const next = add ? [...new Set([...now, host])] : now.filter((d) => d !== host);
  if (next.length !== now.length) await api(`/sites/${siteId()}`, { method: "PATCH", body: JSON.stringify({ domain_aliases: next }) });
  if (add) { try { await api(`/sites/${siteId()}/ssl`, { method: "POST" }); } catch (e) { console.log("ssl provision request:", String(e).slice(0, 160)); } }
}

// Submit URLs to IndexNow (Bing, Yandex, Seznam, Naver and others share submissions). All URLs must be on one host.
export async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; status: number }> {
  if (!urls.length) return { ok: false, status: 0 };
  const host = new URL(urls[0]).host;
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 1000) }),
    });
    console.log(`indexnow ${host} urls=${urls.length} status=${r.status}`);
    return { ok: r.status === 200 || r.status === 202, status: r.status };
  } catch (e) {
    console.error("indexnow failed", e);
    return { ok: false, status: 0 };
  }
}
