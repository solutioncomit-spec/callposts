import type { Config } from "@netlify/functions";

// Domain finder: checks whether names are registered and returns links to buy them at a registrar.
//   GET /api/domain-check?names=a.com,b.net   (up to 12 names; open to everyone, rate-limited per IP)
// Availability comes from the registry's RDAP service (404 = not registered), with a DNS fallback.
// It's a good guide, not a guarantee: premium or reserved names only show up at the registrar's checkout.
const TLDS = ["com", "net", "org", "co", "us", "info", "pro", "site", "online"];
const RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
};

function cleanName(v: string): string | null {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const m = d.match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.([a-z]{2,10})$/);
  if (!m || !TLDS.includes(m[2])) return null;
  return d;
}

async function timed(url: string, ms = 6000, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" }); } finally { clearTimeout(t); }
}

async function check(domain: string): Promise<"available" | "taken" | "unknown"> {
  const tld = domain.split(".").pop()!;
  try {
    const r = await timed(`${RDAP[tld] || "https://rdap.org/domain/"}${domain}`, 6000, { headers: { accept: "application/rdap+json" } });
    if (r.status === 404) return "available";
    if (r.ok) return "taken";
  } catch { /* fall through to DNS */ }
  try {
    const r = await timed(`https://dns.google/resolve?name=${domain}&type=NS`, 4000, { headers: { accept: "application/dns-json" } });
    const j: any = await r.json();
    if (j.Status === 3) return "available"; // NXDOMAIN: nothing registered under this name
    if (j.Status === 0 && (j.Answer || j.Authority)) return "taken";
  } catch {}
  return "unknown";
}

// Registrar links. DOMAIN_LINK_NAMECHEAP / DOMAIN_LINK_PORKBUN can hold an affiliate link template using
// {domain} (the name) or {url} (the registrar's search page, URL-encoded), e.g. an Impact deep link.
const REGISTRARS = [
  { key: "namecheap", name: "Namecheap", env: "DOMAIN_LINK_NAMECHEAP", search: (d: string) => `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
  { key: "porkbun", name: "Porkbun", env: "DOMAIN_LINK_PORKBUN", search: (d: string) => `https://porkbun.com/checkout/search?q=${d}` },
];
function links(domain: string) {
  return REGISTRARS.map((r) => {
    const tpl = Netlify.env.get(r.env);
    const plain = r.search(domain);
    const url = tpl ? tpl.replaceAll("{domain}", domain).replaceAll("{url}", encodeURIComponent(plain)) : plain;
    return { name: r.name, url };
  });
}
const hasAffiliate = () => REGISTRARS.some((r) => !!Netlify.env.get(r.env));

export default async (req: Request) => {
  const raw = (new URL(req.url).searchParams.get("names") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const names = [...new Set(raw.map(cleanName).filter(Boolean) as string[])].slice(0, 12);
  if (!names.length) return Response.json({ error: `Enter a name like lakewoodwaterheaterhelp.com. Supported endings: ${TLDS.map((t) => "." + t).join(", ")}.` }, { status: 400 });
  const results = await Promise.all(names.map(async (domain) => ({ domain, status: await check(domain), links: links(domain) })));
  return Response.json({ results, affiliate: hasAffiliate() }, { headers: { "cache-control": "no-store" } });
};

export const config: Config = {
  path: "/api/domain-check",
  method: ["GET"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
