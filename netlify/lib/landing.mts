// Renders a pay-per-call landing page from saved copy + one of the built-in templates.
// Used by the hosted page (/p/:slug) and by the "Download HTML" option.

export type PageCopy = {
  keyword?: string;
  seoTitle?: string;
  intro?: string;
  signs?: { title: string; text: string }[];
  localNote?: string;
  costFactors?: string[];
  headline: string;
  subheadline: string;
  bullets: string[];
  steps: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  areas: string[];
  cta: string;
  metaDescription: string;
};

export type LandingPage = {
  slug: string;
  owner: string;
  template: "clean" | "bold" | "urgent";
  service: string;
  city: string;
  phone: string;
  brand: string;
  copy: PageCopy;
  photo?: string; // blob key in "page-images"
  created: string;
  views?: number;
};

export const TEMPLATES = {
  clean: { name: "Clean", bg: "#ffffff", surface: "#f4f6fb", ink: "#0f172a", muted: "#475569", line: "#e2e8f0", accent: "#2563eb", accent2: "#1d4ed8", btnInk: "#ffffff", heroBg: "linear-gradient(180deg,#eef4ff,#ffffff)" },
  bold: { name: "Bold dark", bg: "#0b0c10", surface: "#15171c", ink: "#f4f4f5", muted: "#a1a1aa", line: "rgba(255,255,255,.12)", accent: "#3b82f6", accent2: "#6d28d9", btnInk: "#ffffff", heroBg: "radial-gradient(900px 400px at 80% -10%,rgba(109,40,217,.35),transparent 60%),#0b0c10" },
  urgent: { name: "Emergency", bg: "#fffaf5", surface: "#fff1e6", ink: "#1c1917", muted: "#57534e", line: "#fed7aa", accent: "#dc2626", accent2: "#ea580c", btnInk: "#ffffff", heroBg: "linear-gradient(180deg,#fff1e6,#fffaf5)" },
} as const;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const telHref = (p: string) => "tel:+1" + p.replace(/\D/g, "").slice(-10);

export function renderLanding(p: LandingPage, opts: { photoUrl?: string; base?: string } = {}): string {
  const t = TEMPLATES[p.template] || TEMPLATES.clean;
  const c = p.copy;
  const phone = p.phone || "(555) 000-0000";
  const tel = telHref(phone);
  const brand = p.brand || `${p.city.split(",")[0]} ${(c.keyword || p.service).replace(/\b\w/g, (m) => m.toUpperCase())} Help`;
  const town = p.city.split(",")[0];
  const kw = c.keyword || p.service.toLowerCase();
  const KW = kw.replace(/\b\w/g, (m) => m.toUpperCase());
  const title = c.seoTitle || `${p.service} in ${town} | ${brand}`;
  const canonical = opts.base ? `${opts.base}/p/${p.slug}` : "";
  const ldjson = [
    {
      "@context": "https://schema.org", "@type": "Service",
      name: `${p.service} in ${p.city}`, serviceType: p.service,
      description: c.metaDescription,
      areaServed: [{ "@type": "City", name: p.city }, ...c.areas.slice(0, 10).map((a) => ({ "@type": "Place", name: `${a}, ${p.city.split(",")[1]?.trim() || ""}`.replace(/, $/, "") }))],
      provider: { "@type": "Organization", name: brand, telephone: phone },
      ...(canonical ? { url: canonical } : {}),
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  const paras = (txt?: string) => (txt || "").split(/\n\n+/).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(c.metaDescription)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(c.metaDescription)}">
${opts.photoUrl ? `<meta property="og:image" content="${esc(opts.photoUrl)}">` : ""}
<meta name="theme-color" content="${t.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<script type="application/ld+json">${JSON.stringify(ldjson).replace(/</g, "\\u003c")}</script>
<style>
*,*::before,*::after{box-sizing:border-box}
:root{--bg:${t.bg};--surface:${t.surface};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--accent:${t.accent};--accent2:${t.accent2};--btn-ink:${t.btnInk}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,sans-serif;padding-bottom:84px}
.wrap{max-width:1040px;margin:0 auto;padding:0 18px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 0}
.brand{font-weight:800;font-size:19px;letter-spacing:-.01em}
.call{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(90deg,var(--accent),var(--accent2));color:var(--btn-ink);text-decoration:none;font-weight:700;border-radius:10px;padding:14px 22px;font-size:18px;box-shadow:0 10px 30px -12px var(--accent)}
.call.sm{font-size:15px;padding:10px 14px}
.call{white-space:nowrap}
.call .lbl{display:none}
@media (max-width:520px){.call{font-size:16px;padding:13px 16px}header .call.sm .num{display:none}header .call.sm .lbl{display:inline}.hero .ctatxt{display:none}.brand{font-size:17px}}
.hero{background:${t.heroBg};border-bottom:1px solid var(--line)}
.hero .in{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:32px;align-items:center;padding:36px 0 44px}
@media (max-width:820px){.hero .in{grid-template-columns:minmax(0,1fr)}}
.pill{display:inline-block;font-size:13px;font-weight:600;color:var(--accent);border:1px solid var(--line);border-radius:999px;padding:4px 12px;margin-bottom:12px}
h1{font-size:clamp(30px,5vw,50px);line-height:1.08;letter-spacing:-.025em;margin:0 0 14px}
h2{font-size:clamp(23px,3vw,32px);letter-spacing:-.02em;margin:0 0 18px}
.sub{font-size:18px;color:var(--muted);margin:0 0 22px;max-width:56ch}
.hero img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;border:1px solid var(--line);display:block}
.ph{font-size:14px;color:var(--muted);margin-top:10px}
section{padding:44px 0;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:640px){.grid{grid-template-columns:minmax(0,1fr)}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.card b{display:block;margin-bottom:4px}
.check{display:flex;gap:10px;align-items:flex-start}
.check i{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--btn-ink);display:grid;place-items:center;font-style:normal;font-size:13px;margin-top:2px}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;counter-reset:s}
@media (max-width:760px){.steps{grid-template-columns:minmax(0,1fr)}}
.steps .card::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--accent);color:var(--btn-ink);font-weight:700;margin-bottom:8px}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px}
summary{cursor:pointer;font-weight:600}
.areas{display:flex;flex-wrap:wrap;gap:8px}
.areas span{border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:14px;background:var(--surface)}
.band{text-align:center}
.band p{color:var(--muted);margin:0 auto 18px;max-width:52ch}
footer{padding:26px 0 30px;font-size:13px;color:var(--muted)}
.prose p{margin:0 0 14px;color:var(--ink);max-width:72ch}
.prose{font-size:17px}
ul.factors{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;max-width:72ch}
nav.crumbs{font-size:13px;color:var(--muted);padding-top:4px}
.sticky{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--line);display:flex;justify-content:center;z-index:5}
.sticky .call{width:100%;max-width:520px}
</style>
</head>
<body>
<div class="hero"><div class="wrap">
  <header><div class="brand">${esc(brand)}</div><a class="call sm" href="${tel}">📞 <span class="num">${esc(phone)}</span><span class="lbl">Call</span></a></header>
  <div class="in">
    <div>
      <span class="pill">${esc(p.service)} · ${esc(p.city)}</span>
      <h1>${esc(c.headline)}</h1>
      <p class="sub">${esc(c.subheadline)}</p>
      <a class="call" href="${tel}">📞 <span class="ctatxt">${esc(c.cta || "Call now")}: </span>${esc(phone)}</a>
      <div class="ph">Tap to call. We connect you with trusted local pros.</div>
    </div>
    ${opts.photoUrl ? `<img src="${esc(opts.photoUrl)}" alt="${esc(p.service)} in ${esc(p.city)}" width="600" height="600">` : `<div class="card"><b>Why call us</b>${c.bullets.slice(0, 3).map((b) => `<div class="check" style="margin-top:8px"><i>✓</i><span>${esc(b)}</span></div>`).join("")}</div>`}
  </div>
</div></div>

${c.intro ? `<section><div class="wrap prose"><h2>${esc(KW)} in ${esc(town)}: what to know</h2>${paras(c.intro)}</div></section>` : ""}

${c.signs && c.signs.length ? `<section><div class="wrap"><h2>Signs you need ${esc(kw)} in ${esc(town)}</h2><div class="grid">${c.signs.map((x) => `<div class="card"><h3 style="font-size:17px;margin:0 0 6px">${esc(x.title)}</h3><span style="color:var(--muted)">${esc(x.text)}</span></div>`).join("")}</div></div></section>` : ""}

<section><div class="wrap">
  <h2>Why ${esc(town)} homeowners call</h2>
  <div class="grid">${c.bullets.map((b) => `<div class="card check"><i>✓</i><span>${esc(b)}</span></div>`).join("")}</div>
</div></section>

<section><div class="wrap">
  <h2>How it works</h2>
  <div class="steps">${c.steps.map((s) => `<div class="card"><b>${esc(s.title)}</b>${esc(s.text)}</div>`).join("")}</div>
</div></section>

${c.localNote ? `<section><div class="wrap prose"><h2>${esc(KW)} in ${esc(town)}: local conditions</h2>${paras(c.localNote)}</div></section>` : ""}

${c.costFactors && c.costFactors.length ? `<section><div class="wrap"><h2>What affects the cost of ${esc(kw)} in ${esc(town)}</h2><ul class="factors">${c.costFactors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p style="color:var(--muted);margin-top:14px">Every job is different. Call <a href="${tel}" style="color:var(--accent)">${esc(phone)}</a> for an exact quote from a local pro.</p></div></section>` : ""}

<section><div class="wrap">
  <h2>${esc(KW)} questions from ${esc(town)} homeowners</h2>
  ${c.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p style="margin:10px 0 0;color:var(--muted)">${esc(f.a)}</p></details>`).join("")}
</div></section>

${c.areas.length ? `<section><div class="wrap"><h2>${esc(KW)} near ${esc(town)}: areas we help</h2><div class="areas">${c.areas.map((a) => `<span>${esc(a)}</span>`).join("")}</div></div></section>` : ""}

<section class="band"><div class="wrap">
  <h2>${esc(c.cta || "Talk to a local pro today")}</h2>
  <p>Call now and we'll connect you with a local ${esc(kw)} pro in ${esc(town)} who can help.</p>
  <a class="call" href="${tel}">📞 ${esc(phone)}</a>
</div></section>

<footer><div class="wrap">
  <p>${esc(brand)} is a referral service. We connect homeowners with independent local service providers, who set their own prices and terms. Calls may be recorded for quality.</p>
  <p>© ${new Date().getFullYear()} ${esc(brand)}</p>
</div></footer>
<div class="sticky"><a class="call" href="${tel}">📞 Call ${esc(phone)}</a></div>
</body>
</html>`;
}

// SEO score: simple, explainable checks a publisher can act on. Each check has a weight and a tip.
export function seoScore(p: LandingPage): { score: number; words: number; checks: { name: string; ok: boolean; tip: string }[] } {
  const c = p.copy;
  const town = p.city.split(",")[0].toLowerCase();
  const kw = (c.keyword || p.service).toLowerCase();
  const kwCore = kw.split(/\s+/).filter((w) => w.length > 3)[0] || kw;
  const title = c.seoTitle || "";
  const meta = c.metaDescription || "";
  const body = [c.subheadline, c.intro, c.localNote, ...(c.signs || []).flatMap((x) => [x.title, x.text]), ...c.bullets, ...(c.costFactors || []), ...c.steps.flatMap((s) => [s.title, s.text]), ...c.faqs.flatMap((f) => [f.q, f.a])].join(" ");
  const words = body.split(/\s+/).filter(Boolean).length;
  const all = `${title} ${meta} ${c.headline} ${body}`;
  const has = (s: string, w: string) => s.toLowerCase().includes(w);
  const checks: { name: string; ok: boolean; tip: string; w: number }[] = [
    { name: `Enough content (${words} words)`, ok: words >= 800, tip: "Aim for 800+ words of useful local copy. Expand the intro, local conditions or FAQs.", w: 15 },
    { name: `Title length (${title.length} chars)`, ok: title.length >= 30 && title.length <= 62, tip: "Keep the SEO title between 30 and 60 characters so Google shows it in full.", w: 10 },
    { name: "Title has keyword and city", ok: has(title, kwCore) && has(title, town), tip: `Put "${kw}" and "${p.city.split(",")[0]}" in the SEO title.`, w: 12 },
    { name: `Meta description length (${meta.length} chars)`, ok: meta.length >= 110 && meta.length <= 160, tip: "Write a 110-160 character meta description with a reason to call.", w: 8 },
    { name: "Meta description has keyword or city", ok: has(meta, kwCore) || has(meta, town), tip: "Mention the service or city in the meta description.", w: 5 },
    { name: "Main heading has keyword and city", ok: has(c.headline, kwCore) && has(c.headline, town), tip: `The H1 should include "${kw}" and the city.`, w: 10 },
    { name: "Intro mentions keyword early", ok: has((c.intro || "").slice(0, 220), kwCore), tip: "Use the main keyword in the first sentence or two of the intro.", w: 8 },
    { name: `FAQs (${c.faqs.length})`, ok: c.faqs.length >= 5, tip: "Have at least 5 FAQs. They can show up as rich results and answer real searches.", w: 8 },
    { name: `Nearby areas listed (${c.areas.length})`, ok: c.areas.length >= 6, tip: "List 6+ real neighborhoods or suburbs you serve.", w: 6 },
    { name: "Tracking number on the page", ok: p.phone.replace(/\D/g, "").length >= 10, tip: "Add a 10-digit tracking number so every call button works.", w: 8 },
    { name: "Hero photo", ok: !!p.photo, tip: "Pages with a relevant image tend to keep visitors longer. Add an AI photo when you build the page.", w: 4 },
    { name: "Follows listing rules (no \"free\", no prices)", ok: !/\bfree\b/i.test(all) && !/\$\s?\d/.test(all), tip: "Remove the word \"free\" and any dollar amounts from the copy.", w: 6 },
  ];
  const total = checks.reduce((a, x) => a + x.w, 0);
  const got = checks.reduce((a, x) => a + (x.ok ? x.w : 0), 0);
  return { score: Math.round((got / total) * 100), words, checks: checks.map(({ w, ...rest }) => rest) };
}
