// Site audit: fetches one public page and scores it for local SEO, calls, schema, speed and pay-per-call compliance.
// Pure checks live in auditHtml() so they can be tested without the network.

export type Check = { id: string; group: string; name: string; ok: boolean; found: string; tip: string; w: number };
export type AuditResult = {
  url: string; finalUrl: string; status: number; ms: number; bytes: number;
  score: number; groups: { name: string; score: number }[]; checks: Omit<Check, "w">[];
  title: string; phones: string[];
};

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => (tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")) || []).slice(2).find((x) => x !== undefined) || "";
const metaContent = (html: string, key: string, by = "name") => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const t = tags.find((m) => attr(m, by).toLowerCase() === key.toLowerCase());
  return t ? attr(t, "content") : "";
};

export function auditHtml(o: { html: string; url: string; finalUrl: string; status: number; ms: number; robots: string | null; sitemap: boolean; keyword?: string; city?: string }): AuditResult {
  const html = o.html;
  const lower = html.toLowerCase();
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
  const body = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0];
  const bodyNoScript = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = strip(bodyNoScript);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const desc = metaContent(html, "description");
  const robotsMeta = metaContent(html, "robots").toLowerCase();
  const h1s = (body.match(/<h1\b[\s\S]*?<\/h1>/gi) || []).map(strip).filter(Boolean);
  const h2s = (body.match(/<h2\b[\s\S]*?<\/h2>/gi) || []).length;
  const canonical = attr(((html.match(/<link\b[^>]*rel\s*=\s*["']?canonical[^>]*>/i) || [""])[0]), "href");
  const viewport = /<meta\b[^>]*name\s*=\s*["']?viewport/i.test(head);
  const lang = /<html\b[^>]*\blang\s*=/i.test(html);
  const ogTitle = metaContent(html, "og:title", "property");
  const ogImage = metaContent(html, "og:image", "property");
  const imgs = body.match(/<img\b[^>]*>/gi) || [];
  const imgsAlt = imgs.filter((i) => attr(i, "alt").trim()).length;
  const host = new URL(o.finalUrl).host;
  const links = (body.match(/<a\b[^>]*>/gi) || []).map((a) => attr(a, "href").trim()).filter(Boolean);
  const internal = links.filter((h) => { try { const u = new URL(h, o.finalUrl); return u.host === host && !h.startsWith("#") && !/^(tel|mailto):/i.test(h); } catch { return false; } }).length;
  const tels = links.filter((h) => /^tel:/i.test(h));
  const firstTel = lower.indexOf('href="tel:') >= 0 ? lower.indexOf('href="tel:') : lower.indexOf("href='tel:");
  const bodyStart = lower.indexOf("<body");
  const telEarly = firstTel > 0 && bodyStart >= 0 && (firstTel - bodyStart) / Math.max(1, lower.length - bodyStart) < 0.3;
  const phones = [...new Set((text.match(/(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g) || []).map((p) => p.trim()))].slice(0, 5);
  const ldBlocks = (html.match(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).map((s) => s.replace(/^<script[^>]*>|<\/script>$/gi, ""));
  const ldTypes = new Set<string>();
  for (const b of ldBlocks) {
    try {
      const walk = (v: any) => { if (!v || typeof v !== "object") return; if (Array.isArray(v)) return v.forEach(walk); const t = v["@type"]; (Array.isArray(t) ? t : [t]).forEach((x) => x && ldTypes.add(String(x))); Object.values(v).forEach(walk); };
      walk(JSON.parse(b));
    } catch { /* invalid JSON-LD */ }
  }
  const localTypes = [...ldTypes].filter((t) => /LocalBusiness|Service|Organization|Plumber|HVACBusiness|RoofingContractor|Electrician|HomeAndConstructionBusiness|GeneralContractor|MovingCompany|Locksmith|PestControl/i.test(t));
  const headScripts = (head.match(/<script\b[^>]*src[^>]*>/gi) || []).filter((s) => !/\b(async|defer)\b/i.test(s) && !/type\s*=\s*["']?module/i.test(s)).length;
  const bytes = new TextEncoder().encode(html).length;
  const kw = (o.keyword || "").toLowerCase().trim();
  const city = (o.city || "").toLowerCase().split(",")[0].trim();
  const titleL = title.toLowerCase(), h1L = (h1s[0] || "").toLowerCase();
  const all = `${title} ${desc} ${text}`;
  const hasFree = /\bfree\b/i.test(all);
  const prices = all.match(/\$\s?\d[\d,]*(\.\d\d)?/g) || [];
  const privacy = links.some((h) => /privacy/i.test(h)) || /privacy policy/i.test(text);
  const disclosure = /referral service|independent (local )?(service )?providers?|we connect (you|homeowners)|not a contractor|matching service/i.test(text);
  const sitemapOk = o.sitemap || /sitemap:/i.test(o.robots || "");
  const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  const C: Check[] = [];
  const add = (group: string, id: string, name: string, ok: boolean, found: string, tip: string, w: number) => C.push({ group, id, name, ok, found, tip, w });
  // On-page SEO
  add("On-page SEO", "title", "Title tag 30–62 characters", title.length >= 30 && title.length <= 62, title ? `${title.length} chars: “${short(title)}”` : "missing", "Write a title of about 50–60 characters with the service and city, e.g. “Water Heater Repair in Aurora, CO | Brand”.", 10);
  add("On-page SEO", "desc", "Meta description 110–160 characters", desc.length >= 110 && desc.length <= 160, desc ? `${desc.length} chars` : "missing", "Add a 140–155 character description with the service, city and a reason to call.", 6);
  add("On-page SEO", "h1", "Exactly one H1", h1s.length === 1, h1s.length ? `${h1s.length}: “${short(h1s[0], 60)}”` : "none", h1s.length ? "Keep one H1 per page; make the others H2." : "Add one H1 heading with the service and city.", 8);
  add("On-page SEO", "h2", "Clear sections (3+ H2 headings)", h2s >= 3, `${h2s}`, "Break the page into sections with H2 headings: signs, how it works, costs, FAQs, areas served.", 4);
  add("On-page SEO", "words", "Enough content (600+ words)", words >= 600, `${words} words`, "Local service pages that rank usually have 600–1,200 words of useful, specific copy.", 8);
  if (kw || city) {
    const kwCore = kw.split(/\s+/).filter((w) => w.length > 3)[0] || kw;
    add("On-page SEO", "kw", `Title and H1 mention ${[kw && `“${kw}”`, city && `“${city}”`].filter(Boolean).join(" and ")}`, (!kw || (titleL.includes(kwCore) && h1L.includes(kwCore))) && (!city || (titleL.includes(city) && h1L.includes(city))), `title: ${titleL.includes(kwCore) || !kw ? "yes" : "no"} · H1: ${h1L.includes(kwCore) || !kw ? "yes" : "no"}${city ? ` · city in title: ${titleL.includes(city) ? "yes" : "no"}` : ""}`, "Put the main service and the city in both the title and the H1.", 10);
  }
  add("On-page SEO", "alt", "Images have alt text", imgs.length === 0 || imgsAlt / imgs.length >= 0.8, imgs.length ? `${imgsAlt} of ${imgs.length}` : "no images", imgs.length ? "Describe each image in its alt text (e.g. “technician repairing a water heater in Aurora”)." : "Add at least one relevant image with alt text.", imgs.length ? 3 : 2);
  add("On-page SEO", "internal", "Internal links (5+)", internal >= 5, `${internal}`, "Link to your other service and city pages so Google can find and connect them.", 4);
  // Calls
  add("Calls", "tel", "Tap-to-call link", tels.length > 0, tels.length ? `${tels.length} tel: link${tels.length > 1 ? "s" : ""}` : "none", "Wrap the phone number in a tel: link so mobile visitors call with one tap.", 12);
  add("Calls", "telcount", "Call buttons repeated down the page (3+)", tels.length >= 3, `${tels.length}`, "Repeat the call button in the header, after the main sections and in a sticky bar on mobile.", 5);
  add("Calls", "telearly", "Call button near the top", telEarly, telEarly ? "yes" : "no", "Put a call button in the header or hero so it's visible without scrolling.", 6);
  add("Calls", "phone", "Phone number written on the page", phones.length > 0, phones.length ? phones.slice(0, 2).join(", ") : "none found", "Show the number as text too, not only inside buttons or images.", 4);
  // Local & schema
  add("Local & schema", "ld", "Structured data (JSON-LD)", ldBlocks.length > 0, ldTypes.size ? [...ldTypes].slice(0, 5).join(", ") : "none", "Add JSON-LD so Google understands the business, service and area served.", 5);
  add("Local & schema", "local", "Business or Service schema", localTypes.length > 0, localTypes.length ? localTypes.slice(0, 3).join(", ") : "none", "Add LocalBusiness or Service schema with name, telephone and areaServed.", 6);
  add("Local & schema", "faq", "FAQ schema", ldTypes.has("FAQPage"), ldTypes.has("FAQPage") ? "yes" : "no", "Add 5+ real FAQs and mark them up with FAQPage schema.", 4);
  // Technical
  add("Technical", "https", "Served over HTTPS", o.finalUrl.startsWith("https://"), o.finalUrl.startsWith("https://") ? "yes" : "no", "Install an SSL certificate and redirect http to https.", 6);
  add("Technical", "status", "Page loads (HTTP 200)", o.status === 200, `HTTP ${o.status}`, "Fix the page so it returns 200; errors and redirects chains hurt ranking.", 8);
  add("Technical", "index", "Indexable (no noindex)", !/noindex/.test(robotsMeta), robotsMeta || "no robots tag", "Remove “noindex” from the robots meta tag so Google can list the page.", 8);
  add("Technical", "canonical", "Canonical tag", !!canonical, canonical ? short(canonical, 60) : "missing", "Add <link rel=\"canonical\"> pointing to the page's own preferred URL.", 3);
  add("Technical", "mobile", "Mobile viewport", viewport, viewport ? "yes" : "missing", "Add <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">.", 6);
  add("Technical", "speed", "Fast server response (under 1.5 s)", o.ms < 1500, `${(o.ms / 1000).toFixed(2)} s`, "Use caching or a faster host/CDN; slow pages lose both rankings and callers.", 5);
  add("Technical", "size", "Page weight under 500 KB of HTML", bytes < 500_000, `${Math.round(bytes / 1024)} KB`, "Trim inline scripts, page-builder bloat and unused code.", 3);
  add("Technical", "blocking", "Few render-blocking scripts (3 or fewer)", headScripts <= 3, `${headScripts} in <head>`, "Add async or defer to scripts in the head, or move them to the end of the page.", 3);
  add("Technical", "sitemap", "Sitemap available", sitemapOk, sitemapOk ? "yes" : "not found", "Publish /sitemap.xml and list it in robots.txt and Google Search Console.", 4);
  add("Technical", "robots", "robots.txt available", o.robots !== null, o.robots !== null ? "yes" : "not found", "Add a robots.txt that allows crawling and points to the sitemap.", 2);
  add("Technical", "lang", "Language set on the page", lang, lang ? "yes" : "missing", "Add lang=\"en\" to the <html> tag.", 1);
  add("Technical", "og", "Social sharing tags", !!(ogTitle && ogImage), ogTitle && ogImage ? "yes" : ogTitle ? "no image" : "missing", "Add og:title and og:image so shared links show a proper preview.", 2);
  // Compliance
  add("Disclosures & claims", "free", "No “free” claims", !hasFree, hasFree ? "uses “free”" : "clean", "Remove “free” (free quote, free estimate); most call buyers and ad platforms flag it.", 6);
  add("Disclosures & claims", "prices", "No prices or dollar amounts", prices.length === 0, prices.length ? prices.slice(0, 3).join(", ") : "none", "Remove prices and discounts; the price depends on the job and the call gets the quote.", 5);
  add("Disclosures & claims", "disclosure", "Referral disclosure", disclosure, disclosure ? "found" : "not found", "State plainly that the site connects homeowners with independent local providers.", 5);
  add("Disclosures & claims", "privacy", "Privacy policy link", privacy, privacy ? "found" : "not found", "Link a privacy policy in the footer; buyers and ad platforms expect one.", 3);

  const pct = (xs: Check[]) => { const t = xs.reduce((a, x) => a + x.w, 0); return t ? Math.round((xs.reduce((a, x) => a + (x.ok ? x.w : 0), 0) / t) * 100) : 100; };
  const groupNames = [...new Set(C.map((c) => c.group))];
  return {
    url: o.url, finalUrl: o.finalUrl, status: o.status, ms: o.ms, bytes, title, phones,
    score: pct(C),
    groups: groupNames.map((g) => ({ name: g, score: pct(C.filter((c) => c.group === g)) })),
    checks: C.map(({ w, ...rest }) => rest),
  };
}
