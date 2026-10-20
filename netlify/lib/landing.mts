// Renders pay-per-call landing pages (and multi-city site hubs) from saved copy + a built-in theme.
// Used by the hosted pages (/p/:slug, /s/:slug), the theme previews and the downloads.

export type PageCopy = {
  keyword?: string;
  seoTitle?: string;
  intro?: string;
  signs?: { title: string; text: string }[];
  localNote?: string;
  costFactors?: string[];
  services?: { title: string; text: string }[]; // types of help offered
  repairReplace?: string; // repair vs replace guidance, paragraphs
  choosing?: string[]; // how to choose a provider
  seasonal?: { season: string; tip: string }[];
  areaGuide?: string; // short guide to the service area
  headline: string;
  subheadline: string;
  bullets: string[];
  steps: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  areas: string[];
  cta: string;
  metaDescription: string;
};

export type ThemeKey = "clean" | "bold" | "urgent" | "heritage" | "meadow" | "neon" | "minimal" | "sunset";

export type LandingPage = {
  slug: string;
  owner: string;
  template: ThemeKey;
  service: string;
  city: string;
  phone: string;
  brand: string;
  copy: PageCopy;
  photo?: string; // blob key in "page-images"
  site?: string; // slug of the city site this page belongs to
  variant?: number; // layout variant, so pages in one city site don't share a structure
  created: string;
  views?: number;
};

// A city site: one service across several cities, with a hub page linking every city page.
export type Site = {
  slug: string;
  owner: string;
  theme: ThemeKey;
  service: string;
  region: string;
  phone: string;
  brand: string;
  cities: string[];
  pages: { slug: string; city: string }[];
  photo: boolean;
  created: string;
  views?: number;
  domain?: string; // connected custom domain, e.g. www.aurorawaterheaters.com
  pingedAt?: string; // last search engine submission
};

// File name / path for a city page on a self-hosted or custom-domain site: "Aurora, CO" -> "aurora-co".
export const cityFile = (p: { city: string; slug: string }) => p.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || p.slug;

type Theme = {
  name: string; tag: string; dark: boolean;
  hero: "split" | "center" | "photo";
  head: string; body: string; fonts: string;
  radius: number; btn: "gradient" | "solid" | "pill"; alt: boolean;
  bg: string; surface: string; ink: string; muted: string; line: string;
  accent: string; accent2: string; btnInk: string; heroBg: string;
  heroInk?: string; heroMuted?: string; link?: string;
};

export const TEMPLATES: Record<ThemeKey, Theme> = {
  clean: { name: "Clean", tag: "Bright and simple. Works for any service.", dark: false, hero: "split", head: "Inter", body: "Inter", fonts: "Inter:wght@400;500;600;700;800", radius: 12, btn: "gradient", alt: false, bg: "#ffffff", surface: "#f4f6fb", ink: "#0f172a", muted: "#475569", line: "#e2e8f0", accent: "#2563eb", accent2: "#1d4ed8", btnInk: "#ffffff", heroBg: "linear-gradient(180deg,#eef4ff,#ffffff)" },
  bold: { name: "Bold dark", tag: "Dark and modern with a violet glow.", dark: true, hero: "split", head: "Inter", body: "Inter", fonts: "Inter:wght@400;500;600;700;800", radius: 12, btn: "gradient", alt: false, bg: "#0b0c10", surface: "#15171c", ink: "#f4f4f5", muted: "#a1a1aa", line: "rgba(255,255,255,.12)", accent: "#3b82f6", accent2: "#6d28d9", btnInk: "#ffffff", heroBg: "radial-gradient(900px 400px at 80% -10%,rgba(109,40,217,.35),transparent 60%),#0b0c10", link: "#93c5fd" },
  urgent: { name: "Emergency", tag: "Red and urgent, for leaks, floods and breakdowns.", dark: false, hero: "split", head: "Archivo", body: "Inter", fonts: "Archivo:wght@700;800;900&family=Inter:wght@400;500;600", radius: 8, btn: "solid", alt: false, bg: "#fffaf5", surface: "#fff1e6", ink: "#1c1917", muted: "#57534e", line: "#fed7aa", accent: "#dc2626", accent2: "#b91c1c", btnInk: "#ffffff", heroBg: "linear-gradient(180deg,#fff1e6,#fffaf5)" },
  heritage: { name: "Heritage", tag: "Navy and gold with serif headings. Feels established.", dark: false, hero: "center", head: "Fraunces", body: "Source Sans 3", fonts: "Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600;700", radius: 6, btn: "solid", alt: true, bg: "#fbfaf7", surface: "#f2efe7", ink: "#13233d", muted: "#55617a", line: "#e3ddcf", accent: "#b8862b", accent2: "#94691c", btnInk: "#ffffff", heroBg: "radial-gradient(700px 300px at 50% 0%,rgba(184,134,43,.22),transparent 70%),#13233d", heroInk: "#ffffff", heroMuted: "rgba(255,255,255,.78)", link: "#94691c" },
  meadow: { name: "Meadow", tag: "Soft green and rounded. Friendly for lawn, pest and cleaning.", dark: false, hero: "split", head: "Nunito", body: "Nunito", fonts: "Nunito:wght@400;600;700;800;900", radius: 20, btn: "pill", alt: true, bg: "#f6fbf7", surface: "#e8f5ec", ink: "#0f2a1d", muted: "#4b6356", line: "#cde5d5", accent: "#16a34a", accent2: "#15803d", btnInk: "#ffffff", heroBg: "linear-gradient(180deg,#dff3e6,#f6fbf7)", link: "#15803d" },
  neon: { name: "Neon", tag: "Near-black with cyan and violet. Techy and eye-catching.", dark: true, hero: "center", head: "Space Grotesk", body: "Inter", fonts: "Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600", radius: 14, btn: "gradient", alt: false, bg: "#06070d", surface: "#10131f", ink: "#eef1ff", muted: "#98a0c3", line: "rgba(130,160,255,.18)", accent: "#22d3ee", accent2: "#8b5cf6", btnInk: "#04121a", heroBg: "radial-gradient(700px 360px at 20% 0%,rgba(34,211,238,.20),transparent 60%),radial-gradient(700px 360px at 85% 10%,rgba(139,92,246,.26),transparent 60%),#06070d", link: "#67e8f9" },
  minimal: { name: "Minimal", tag: "Black on white, big type, nothing extra.", dark: false, hero: "center", head: "Manrope", body: "Manrope", fonts: "Manrope:wght@400;500;600;700;800", radius: 4, btn: "solid", alt: false, bg: "#fafaf9", surface: "#f1f1ef", ink: "#111111", muted: "#57534e", line: "#e4e4e0", accent: "#111111", accent2: "#111111", btnInk: "#ffffff", heroBg: "#fafaf9", link: "#111111" },
  sunset: { name: "Sunset photo", tag: "Full-width photo hero with warm amber buttons.", dark: false, hero: "photo", head: "Poppins", body: "Poppins", fonts: "Poppins:wght@400;500;600;700;800", radius: 12, btn: "pill", alt: true, bg: "#fffbf5", surface: "#fff1df", ink: "#24170c", muted: "#6b5444", line: "#f3d9bb", accent: "#f59e0b", accent2: "#ea580c", btnInk: "#1c1003", heroBg: "linear-gradient(135deg,#7c2d12,#c2410c 60%,#f59e0b)", heroInk: "#ffffff", heroMuted: "rgba(255,255,255,.88)", link: "#c2410c" },
};
export const THEME_KEYS = Object.keys(TEMPLATES) as ThemeKey[];
export const isTheme = (v: unknown): v is ThemeKey => typeof v === "string" && v in TEMPLATES;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const telHref = (p: string) => "tel:+1" + p.replace(/\D/g, "").slice(-10);
const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
const jsonLd = (v: unknown) => `<script type="application/ld+json">${JSON.stringify(v).replace(/</g, "\\u003c")}</script>`;

const STATES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington, DC" };

// "Aurora, CO" + "Denver, CO" -> "Colorado"; mixed states -> "Aurora, Denver & nearby".
export function defaultRegion(cities: string[]): string {
  const states = [...new Set(cities.map((c) => (c.split(",")[1] || "").trim().toUpperCase()).filter(Boolean))];
  if (states.length === 1 && STATES[states[0]]) return STATES[states[0]];
  const towns = cities.map((c) => c.split(",")[0].trim());
  return towns.length > 2 ? `${towns[0]}, ${towns[1]} & nearby` : towns.join(" & ");
}

export type SiteNav = { hubName: string; hubHref: string; cities: { name: string; href: string; current?: boolean }[] };

function css(t: Theme, extra = ""): string {
  const btnBg = t.btn === "solid" ? "var(--accent)" : "linear-gradient(90deg,var(--accent),var(--accent2))";
  const btnRadius = t.btn === "pill" ? "999px" : `${Math.max(6, Math.min(t.radius, 12))}px`;
  const heroInk = t.heroInk || t.ink, heroMuted = t.heroMuted || t.muted;
  return `*,*::before,*::after{box-sizing:border-box}
:root{--bg:${t.bg};--surface:${t.surface};--ink:${t.ink};--muted:${t.muted};--line:${t.line};--accent:${t.accent};--accent2:${t.accent2};--btn-ink:${t.btnInk};--r:${t.radius}px;--hero-ink:${heroInk};--hero-muted:${heroMuted};--link:${t.link || t.accent}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 "${t.body}",system-ui,sans-serif;padding-bottom:84px}
h1,h2,h3,.brand{font-family:"${t.head}",system-ui,sans-serif}
a{color:var(--link)}
.wrap{max-width:1060px;margin:0 auto;padding:0 18px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 0}
.hl{display:flex;align-items:center;gap:18px;min-width:0}
.brand{font-weight:800;font-size:19px;letter-spacing:-.01em;color:inherit;text-decoration:none}
.navlink{font-size:14px;font-weight:600;color:inherit;opacity:.8;text-decoration:none}
.call{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:${btnBg};color:var(--btn-ink);text-decoration:none;font-weight:700;border-radius:${btnRadius};padding:14px 24px;font-size:18px;white-space:nowrap;box-shadow:0 10px 30px -14px var(--accent)}
.call.sm{font-size:15px;padding:10px 16px;box-shadow:none}
.call .lbl{display:none}
@media (max-width:560px){.call{font-size:16px;padding:13px 16px}header .call.sm .num{display:none}header .call.sm .lbl{display:inline}.hero .ctatxt{display:none}.brand{font-size:17px}.navlink{display:none}}
.hero{background:${t.heroBg};border-bottom:1px solid var(--line);color:var(--hero-ink)}
.hero .in{padding:34px 0 48px}
.hero.split .in{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:34px;align-items:center}
@media (max-width:820px){.hero.split .in{grid-template-columns:minmax(0,1fr)}}
.hero.center .in,.hero.photo .in{text-align:center;max-width:820px;margin:0 auto}
.hero.center .sub,.hero.photo .sub{margin-left:auto;margin-right:auto}
.hero.photo{background-size:cover;background-position:center}
.hero.photo .in{padding:56px 0 72px}
.pill{display:inline-block;font-size:13px;font-weight:600;color:var(--accent);border:1px solid var(--line);border-radius:999px;padding:4px 12px;margin-bottom:14px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.hero.center .pill,.hero.photo .pill{color:var(--hero-ink);border-color:color-mix(in srgb,var(--hero-ink) 30%,transparent);background:transparent}
h1{font-size:clamp(32px,5.2vw,54px);line-height:1.06;letter-spacing:-.025em;margin:0 0 16px;font-weight:800}
h2{font-size:clamp(23px,3vw,33px);line-height:1.15;letter-spacing:-.02em;margin:0 0 18px;font-weight:700}
.sub{font-size:18px;color:var(--hero-muted);margin:0 0 24px;max-width:58ch}
.hero img.side{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r);border:1px solid var(--line);display:block}
.hero img.wide{width:100%;max-width:880px;aspect-ratio:16/9;object-fit:cover;border-radius:var(--r);display:block;margin:30px auto 0;border:1px solid color-mix(in srgb,var(--hero-ink) 18%,transparent)}
.ph{font-size:14px;color:var(--hero-muted);margin-top:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:24px}
.chips span{font-size:14px;border:1px solid color-mix(in srgb,var(--hero-ink) 25%,transparent);border-radius:999px;padding:6px 12px}
.crumbs{font-size:13px;color:var(--hero-muted);padding-top:2px}.crumbs a{color:inherit}
section{padding:48px 0;border-bottom:1px solid var(--line)}
${t.alt ? "section:nth-of-type(even){background:var(--surface)}section:nth-of-type(even) .card,section:nth-of-type(even) details{background:var(--bg)}" : ""}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media (max-width:760px){.grid3{grid-template-columns:minmax(0,1fr)}}
@media (max-width:640px){.grid{grid-template-columns:minmax(0,1fr)}}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.card b{display:block;margin-bottom:4px}
a.card{text-decoration:none;color:var(--ink);display:block}
a.card:hover{border-color:var(--accent)}
.check{display:flex;gap:10px;align-items:flex-start}
.check i{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent);color:var(--btn-ink);display:grid;place-items:center;font-style:normal;font-size:13px;margin-top:2px}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;counter-reset:s}
@media (max-width:760px){.steps{grid-template-columns:minmax(0,1fr)}}
.steps .card::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:30px;height:30px;border-radius:min(var(--r),8px);background:var(--accent);color:var(--btn-ink);font-weight:700;margin-bottom:8px}
details{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 18px;margin-bottom:10px}
summary{cursor:pointer;font-weight:600}
.areas{display:flex;flex-wrap:wrap;gap:8px}
.areas span,.areas a{border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:14px;background:var(--surface);color:var(--ink);text-decoration:none}
.areas a:hover{border-color:var(--accent)}
.band{text-align:center}
.band p{color:var(--muted);margin:0 auto 18px;max-width:52ch}
footer{padding:26px 0 30px;font-size:13px;color:var(--muted)}
footer .links{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:10px}footer .links a{color:var(--muted)}
.prose p{margin:0 0 14px;max-width:72ch}
.prose{font-size:17px}
ul.factors{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;max-width:72ch}
.sticky{position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--line);display:flex;justify-content:center;z-index:5}
.sticky .call{width:100%;max-width:520px}
${extra}`;
}

function head(t: Theme, o: { title: string; desc: string; canonical?: string; image?: string; ld: unknown[]; noindex?: boolean }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ""}
<meta name="robots" content="${o.noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">
<meta property="og:type" content="website">
${o.canonical ? `<meta property="og:url" content="${esc(o.canonical)}">` : ""}
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
${o.image ? `<meta property="og:image" content="${esc(o.image)}">` : ""}
<meta name="theme-color" content="${t.bg}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap">
${o.ld.map(jsonLd).join("\n")}`;
}

function heroStyle(t: Theme, photoUrl?: string) {
  return t.hero === "photo" && photoUrl ? ` style="background-image:linear-gradient(rgba(12,7,3,.64),rgba(12,7,3,.64)),url('${esc(photoUrl)}')"` : "";
}

export function renderLanding(p: LandingPage, opts: { photoUrl?: string; base?: string; site?: SiteNav; canonical?: string; noindex?: boolean; privacyHref?: string } = {}): string {
  const t = TEMPLATES[p.template] || TEMPLATES.clean;
  const c = p.copy;
  const phone = p.phone || "(555) 000-0000";
  const tel = telHref(phone);
  const town = p.city.split(",")[0];
  const kw = c.keyword || p.service.toLowerCase();
  const KW = titleCase(kw);
  const brand = p.brand || `${town} ${KW} Help`;
  const title = c.seoTitle || `${p.service} in ${town} | ${brand}`;
  const canonical = opts.canonical || (opts.base ? `${opts.base}/p/${p.slug}` : "");
  const nav = opts.site;
  const others = nav ? nav.cities.filter((x) => !x.current) : [];
  const ld: unknown[] = [
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
  if (nav && opts.base) ld.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: nav.hubName, item: nav.hubHref.startsWith("http") ? nav.hubHref : `${opts.base}${nav.hubHref}` }, { "@type": "ListItem", position: 2, name: town, item: canonical }] });
  const paras = (txt?: string) => (txt || "").split(/\n\n+/).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
  const why = `<div class="card" style="color:var(--ink)"><b>Why call us</b>${c.bullets.slice(0, 3).map((b) => `<div class="check" style="margin-top:8px"><i>✓</i><span>${esc(b)}</span></div>`).join("")}</div>`;
  const visual = t.hero === "split"
    ? (opts.photoUrl ? `<img class="side" src="${esc(opts.photoUrl)}" alt="${esc(p.service)} in ${esc(p.city)}" width="600" height="600">` : why)
    : t.hero === "center" && opts.photoUrl
      ? `<img class="wide" src="${esc(opts.photoUrl)}" alt="${esc(p.service)} in ${esc(p.city)}" width="880" height="495">`
      : `<div class="chips">${c.bullets.slice(0, 3).map((b) => `<span>✓ ${esc(b.length > 48 ? b.slice(0, 46).replace(/\s+\S*$/, "") + "…" : b)}</span>`).join("")}</div>`;
  const text = `<div>
      <span class="pill">${esc(p.service)} · ${esc(p.city)}</span>
      <h1>${esc(c.headline)}</h1>
      <p class="sub">${esc(c.subheadline)}</p>
      <a class="call" href="${tel}">📞 <span class="ctatxt">${esc(c.cta || "Call now")}: </span>${esc(phone)}</a>
      <div class="ph">Tap to call. We connect you with trusted local pros.</div>
    </div>`;

  // Body sections. Pages in a city site use different orders (by variant) so they don't share one structure.
  const card = (t: string, x: string) => `<div class="card"><h3 style="font-size:17px;margin:0 0 6px">${esc(t)}</h3><span style="color:var(--muted)">${esc(x)}</span></div>`;
  const sec: Record<string, string> = {
    intro: c.intro ? `<section><div class="wrap prose"><h2>${esc(KW)} in ${esc(town)}: what to know</h2>${paras(c.intro)}</div></section>` : "",
    signs: c.signs && c.signs.length ? `<section><div class="wrap"><h2>Signs you need ${esc(kw)} in ${esc(town)}</h2><div class="grid">${c.signs.map((x) => card(x.title, x.text)).join("")}</div></div></section>` : "",
    services: c.services && c.services.length ? `<section><div class="wrap"><h2>Types of ${esc(kw)} help in ${esc(town)}</h2><div class="grid">${c.services.map((x) => card(x.title, x.text)).join("")}</div></div></section>` : "",
    why: c.bullets.length ? `<section><div class="wrap"><h2>Why ${esc(town)} homeowners call</h2><div class="grid">${c.bullets.map((b) => `<div class="card check"><i>✓</i><span>${esc(b)}</span></div>`).join("")}</div></div></section>` : "",
    how: c.steps.length ? `<section><div class="wrap"><h2>How it works</h2><div class="steps">${c.steps.map((x) => `<div class="card"><b>${esc(x.title)}</b>${esc(x.text)}</div>`).join("")}</div></div></section>` : "",
    rvr: c.repairReplace ? `<section><div class="wrap prose"><h2>Repair or replace? How ${esc(town)} homeowners decide</h2>${paras(c.repairReplace)}</div></section>` : "",
    local: c.localNote ? `<section><div class="wrap prose"><h2>${esc(KW)} in ${esc(town)}: local conditions</h2>${paras(c.localNote)}</div></section>` : "",
    cost: c.costFactors && c.costFactors.length ? `<section><div class="wrap"><h2>What affects the cost of ${esc(kw)} in ${esc(town)}</h2><ul class="factors">${c.costFactors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p style="color:var(--muted);margin-top:14px">Every job is different. Call <a href="${tel}">${esc(phone)}</a> for an exact quote from a local pro.</p></div></section>` : "",
    seasonal: c.seasonal && c.seasonal.length ? `<section><div class="wrap"><h2>Seasonal ${esc(kw)} tips for ${esc(town)}</h2><div class="grid">${c.seasonal.map((x) => card(x.season, x.tip)).join("")}</div></div></section>` : "",
    choose: c.choosing && c.choosing.length ? `<section><div class="wrap"><h2>How to choose a ${esc(kw)} pro in ${esc(town)}</h2><ul class="factors">${c.choosing.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></section>` : "",
    faq: c.faqs.length ? `<section><div class="wrap"><h2>${esc(KW)} questions from ${esc(town)} homeowners</h2>${c.faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p style="margin:10px 0 0;color:var(--muted)">${esc(f.a)}</p></details>`).join("")}</div></section>` : "",
    areas: c.areas.length || c.areaGuide ? `<section><div class="wrap"><h2>${esc(KW)} near ${esc(town)}: areas we help</h2>${c.areaGuide ? `<div class="prose" style="margin-bottom:16px">${paras(c.areaGuide)}</div>` : ""}${c.areas.length ? `<div class="areas">${c.areas.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}</div></section>` : "",
  };
  const ORDERS = [
    ["intro", "signs", "services", "why", "how", "rvr", "local", "cost", "seasonal", "choose", "faq", "areas"],
    ["intro", "services", "rvr", "signs", "how", "local", "why", "cost", "choose", "seasonal", "faq", "areas"],
    ["intro", "local", "signs", "services", "cost", "rvr", "why", "seasonal", "how", "choose", "faq", "areas"],
    ["intro", "why", "seasonal", "signs", "services", "choose", "local", "rvr", "how", "cost", "faq", "areas"],
  ];
  const seed = p.variant ?? [...p.slug].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const body = ORDERS[Math.abs(seed) % ORDERS.length].map((k) => sec[k]).filter(Boolean).join("\n\n");
  return `${head(t, { title, desc: c.metaDescription, canonical, image: opts.photoUrl, ld, noindex: opts.noindex })}
<style>${css(t)}</style>
</head>
<body>
<div class="hero ${t.hero}"${heroStyle(t, opts.photoUrl)}><div class="wrap">
  <header><div class="hl">${nav ? `<a class="brand" href="${esc(nav.hubHref)}">${esc(brand)}</a><a class="navlink" href="${esc(nav.hubHref)}">All areas</a>` : `<div class="brand">${esc(brand)}</div>`}</div><a class="call sm" href="${tel}">📞 <span class="num">${esc(phone)}</span><span class="lbl">Call</span></a></header>
  ${nav ? `<nav class="crumbs" aria-label="Breadcrumb"><a href="${esc(nav.hubHref)}">${esc(nav.hubName)}</a> › ${esc(town)}</nav>` : ""}
  <div class="in">
    ${text}
    ${visual}
  </div>
</div></div>

${body}

${others.length ? `<section><div class="wrap"><h2>${esc(KW)} in other cities</h2><div class="areas">${others.map((x) => `<a href="${esc(x.href)}">${esc(KW)} in ${esc(x.name.split(",")[0])}</a>`).join("")}<a href="${esc(nav!.hubHref)}">All service areas</a></div></div></section>` : ""}

<section class="band"><div class="wrap">
  <h2>${esc(c.cta || "Talk to a local pro today")}</h2>
  <p>Call now and we'll connect you with a local ${esc(kw)} pro in ${esc(town)} who can help.</p>
  <a class="call" href="${tel}">📞 ${esc(phone)}</a>
</div></section>

<footer><div class="wrap">
  ${nav ? `<div class="links"><a href="${esc(nav.hubHref)}">${esc(nav.hubName)}</a>${nav.cities.map((x) => `<a href="${esc(x.href)}">${esc(x.name.split(",")[0])}</a>`).join("")}</div>` : ""}
  <p>${esc(brand)} is a referral service. We connect homeowners with independent local service providers, who set their own prices and terms. Calls may be recorded for quality.</p>
  <p>© ${new Date().getFullYear()} ${esc(brand)}${opts.privacyHref ? ` · <a href="${esc(opts.privacyHref)}">Privacy policy</a>` : ""}</p>
</div></footer>
<div class="sticky"><a class="call" href="${tel}">📞 Call ${esc(phone)}</a></div>
</body>
</html>`;
}

// Hub page of a city site: one service across a region, linking to every city page.
export function renderHub(site: Site, pages: LandingPage[], opts: { base?: string; photoUrl?: string; cityHref: (p: LandingPage) => string; selfHref: string; canonical?: string; noindex?: boolean; privacyHref?: string }): string {
  const t = TEMPLATES[site.theme] || TEMPLATES.clean;
  const first = pages[0];
  const kw = first?.copy.keyword || site.service.toLowerCase();
  const KW = titleCase(kw);
  const phone = site.phone || "(555) 000-0000";
  const tel = telHref(phone);
  const brand = site.brand || `${site.region} ${KW} Help`;
  const towns = pages.map((p) => p.city.split(",")[0]);
  const townList = towns.length > 3 ? `${towns.slice(0, 3).join(", ")} and ${towns.length - 3} more` : towns.join(", ").replace(/, ([^,]*)$/, " and $1");
  const title = `${KW} in ${site.region} | ${brand}`.slice(0, 70);
  const desc = `Need ${kw} in ${site.region}? Call ${phone} to reach a local pro in ${townList}. One number, quick connection to independent local experts.`.slice(0, 160);
  const canonical = opts.canonical || (opts.base ? `${opts.base}${opts.selfHref}` : "");
  const ld: unknown[] = [{
    "@context": "https://schema.org", "@type": "Service", name: `${KW} in ${site.region}`, serviceType: site.service, description: desc,
    areaServed: pages.map((p) => ({ "@type": "City", name: p.city })),
    provider: { "@type": "Organization", name: brand, telephone: phone },
    ...(canonical ? { url: canonical } : {}),
  }];
  const bullets = first?.copy.bullets || [];
  const steps = first?.copy.steps || [];
  const visual = t.hero === "split"
    ? (opts.photoUrl ? `<img class="side" src="${esc(opts.photoUrl)}" alt="${esc(site.service)} in ${esc(site.region)}" width="600" height="600">` : `<div class="card" style="color:var(--ink)"><b>Cities we cover</b><div class="areas" style="margin-top:10px">${pages.map((p) => `<a href="${esc(opts.cityHref(p))}">${esc(p.city.split(",")[0])}</a>`).join("")}</div></div>`)
    : t.hero === "center" && opts.photoUrl ? `<img class="wide" src="${esc(opts.photoUrl)}" alt="${esc(site.service)} in ${esc(site.region)}" width="880" height="495">`
      : `<div class="chips">${towns.slice(0, 6).map((x) => `<span>${esc(x)}</span>`).join("")}</div>`;
  return `${head(t, { title, desc, canonical, image: opts.photoUrl, ld, noindex: opts.noindex })}
<style>${css(t)}</style>
</head>
<body>
<div class="hero ${t.hero}"${heroStyle(t, opts.photoUrl)}><div class="wrap">
  <header><div class="hl"><a class="brand" href="${esc(opts.selfHref)}">${esc(brand)}</a></div><a class="call sm" href="${tel}">📞 <span class="num">${esc(phone)}</span><span class="lbl">Call</span></a></header>
  <div class="in">
    <div>
      <span class="pill">${esc(site.service)} · ${pages.length} cities</span>
      <h1>${esc(KW)} in ${esc(site.region)}</h1>
      <p class="sub">One call connects you with a local ${esc(kw)} pro in ${esc(townList)}. Pick your city below or call now.</p>
      <a class="call" href="${tel}">📞 <span class="ctatxt">Call now: </span>${esc(phone)}</a>
      <div class="ph">Tap to call. We connect you with trusted local pros.</div>
    </div>
    ${visual}
  </div>
</div></div>

<section><div class="wrap">
  <h2>Choose your city</h2>
  <div class="grid3">${pages.map((p) => `<a class="card" href="${esc(opts.cityHref(p))}"><h3 style="font-size:18px;margin:0 0 6px">${esc(KW)} in ${esc(p.city.split(",")[0])}</h3><span style="color:var(--muted);font-size:15px">${esc(p.copy.subheadline)}</span><span style="display:block;margin-top:10px;font-weight:600;color:var(--link)">See ${esc(p.city.split(",")[0])} →</span></a>`).join("")}</div>
</div></section>

${bullets.length ? `<section><div class="wrap"><h2>Why homeowners in ${esc(site.region)} call</h2><div class="grid">${bullets.map((b) => `<div class="card check"><i>✓</i><span>${esc(b)}</span></div>`).join("")}</div></div></section>` : ""}

${steps.length ? `<section><div class="wrap"><h2>How it works</h2><div class="steps">${steps.map((s) => `<div class="card"><b>${esc(s.title)}</b>${esc(s.text)}</div>`).join("")}</div></div></section>` : ""}

<section class="band"><div class="wrap">
  <h2>Talk to a local ${esc(kw)} pro today</h2>
  <p>Call now and we'll connect you with an independent pro near you in ${esc(site.region)}.</p>
  <a class="call" href="${tel}">📞 ${esc(phone)}</a>
</div></section>

<footer><div class="wrap">
  <div class="links">${pages.map((p) => `<a href="${esc(opts.cityHref(p))}">${esc(KW)} ${esc(p.city.split(",")[0])}</a>`).join("")}</div>
  <p>${esc(brand)} is a referral service. We connect homeowners with independent local service providers, who set their own prices and terms. Calls may be recorded for quality.</p>
  <p>© ${new Date().getFullYear()} ${esc(brand)}${opts.privacyHref ? ` · <a href="${esc(opts.privacyHref)}">Privacy policy</a>` : ""}</p>
</div></footer>
<div class="sticky"><a class="call" href="${tel}">📞 Call ${esc(phone)}</a></div>
</body>
</html>`;
}

// Privacy policy page for a hosted page or city site, in the same theme. It describes what these pages actually do:
// no forms, no tracking cookies, phone calls connected to independent providers.
export function renderPrivacy(o: { theme: ThemeKey; brand: string; phone: string; homeHref: string; homeName: string }): string {
  const t = TEMPLATES[o.theme] || TEMPLATES.clean;
  const tel = telHref(o.phone || "");
  const year = new Date().getFullYear();
  return `${head(t, { title: `Privacy policy | ${o.brand}`, desc: `How ${o.brand} handles information when you visit this site or call.`, ld: [], noindex: true })}
<style>${css(t, ".policy{max-width:760px;padding:28px 0 56px}.policy h1{font-size:clamp(28px,4vw,40px)}.policy h2{font-size:20px;margin:28px 0 8px}.policy p,.policy li{color:var(--ink)}.policy .muted{color:var(--muted)}")}</style>
</head>
<body style="padding-bottom:0">
<div class="wrap">
  <header><div class="hl"><a class="brand" href="${esc(o.homeHref)}">${esc(o.brand)}</a></div>${o.phone ? `<a class="call sm" href="${tel}">📞 <span class="num">${esc(o.phone)}</span><span class="lbl">Call</span></a>` : ""}</header>
  <main class="policy">
    <h1>Privacy policy</h1>
    <p class="muted">Last updated ${year}</p>
    <p>${esc(o.brand)} is a referral service that connects homeowners with independent local service providers. This page explains what information is involved when you visit this website or call the number on it.</p>
    <h2>What this website collects</h2>
    <p>This website has no forms and does not ask you to enter personal information. It does not use advertising or tracking cookies. Like most websites, our hosting provider keeps standard technical logs (such as IP address, browser type and the page requested) for security and to keep the site running, and we count page views without identifying you.</p>
    <h2>When you call</h2>
    <p>Calls to the number on this site are routed through a call tracking service so they can be connected to an independent local provider who can help with your request. The call system may record the phone number you call from, the time and length of the call, and the area you're calling about. Calls may be recorded for quality and training. The provider you are connected with receives the details you share on the call so they can help you, and handles them under their own privacy practices.</p>
    <h2>How information is used</h2>
    <ul><li>To connect you with a local provider for the service you asked about.</li><li>To keep the service working, prevent abuse and measure call quality.</li><li>To meet legal obligations.</li></ul>
    <p>We do not sell your personal information, and we do not send you marketing messages from this website.</p>
    <h2>Your choices</h2>
    <p>You can end a call at any time. To ask about information related to a call you made, or to request that it be deleted where the law allows, call ${o.phone ? `<a href="${tel}">${esc(o.phone)}</a>` : "the number on this site"} and ask about your privacy request.</p>
    <h2>Children</h2>
    <p>This website is meant for adults arranging home services and is not directed at children under 13.</p>
    <h2>Changes</h2>
    <p>We may update this policy from time to time. The date above shows when it last changed.</p>
    <p style="margin-top:28px"><a href="${esc(o.homeHref)}">← Back to ${esc(o.homeName)}</a></p>
  </main>
</div>
</body>
</html>`;
}

// Sample page used for the theme gallery previews.
export function samplePage(theme: ThemeKey): LandingPage {
  return {
    slug: "preview", owner: "", template: theme, service: "Water Heater Repair", city: "Aurora, CO", phone: "(555) 123-4567", brand: "Aurora Water Heater Help", created: "", photo: "sample",
    copy: {
      keyword: "water heater repair",
      seoTitle: "Water Heater Repair in Aurora, CO | Call a Local Pro",
      metaDescription: "Need water heater repair in Aurora? Call now to reach a local pro for leaks, no hot water, pilot problems and replacements.",
      headline: "Water Heater Repair in Aurora, Done Right",
      subheadline: "No hot water, leaks or strange noises? One call connects you with a local Aurora water heater pro.",
      intro: "Water heater repair in Aurora usually starts with a cold shower or a puddle near the tank. Most problems trace back to a few common causes: sediment, a failing element or thermostat, or a worn anode rod.\n\nA local pro can tell you quickly whether a repair makes sense or whether it's time to replace the unit.",
      bullets: ["Tank and tankless units", "Gas and electric systems", "Repair or replacement advice", "Local pros who know Aurora homes"],
      steps: [{ title: "Call", text: "Tell us what's going on with your water heater." }, { title: "Get matched", text: "We connect you with a local pro near you." }, { title: "Get it fixed", text: "The pro explains your options and gets hot water back." }],
      signs: [{ title: "No hot water", text: "The burner, element or thermostat may have failed." }, { title: "Rumbling or popping", text: "Sediment has built up at the bottom of the tank." }],
      localNote: "Aurora's hard water speeds up sediment build-up, so tanks here often need flushing more often than in softer-water areas.",
      costFactors: ["Tank or tankless unit", "Gas or electric", "Which part has failed"],
      faqs: [{ q: "Should I repair or replace my water heater?", a: "If the tank is leaking from the body, replacement is usually the answer. Many other problems can be repaired." }, { q: "How long does a repair take?", a: "Most common repairs are finished in a single visit." }],
      areas: ["Southlake", "Saddle Rock", "Tallyn's Reach", "Murphy Creek", "Hoffman Heights", "Del Mar"],
      cta: "Call a local pro",
    },
  };
}

// SEO score: simple, explainable checks a publisher can act on. Each check has a weight and a tip.
export function seoScore(p: LandingPage): { score: number; words: number; checks: { name: string; ok: boolean; tip: string }[] } {
  const c = p.copy;
  const town = p.city.split(",")[0].toLowerCase();
  const kw = (c.keyword || p.service).toLowerCase();
  const kwCore = kw.split(/\s+/).filter((w) => w.length > 3)[0] || kw;
  const title = c.seoTitle || "";
  const meta = c.metaDescription || "";
  const body = [c.subheadline, c.intro, c.localNote, c.repairReplace, c.areaGuide, ...(c.signs || []).flatMap((x) => [x.title, x.text]), ...(c.services || []).flatMap((x) => [x.title, x.text]), ...(c.seasonal || []).flatMap((x) => [x.season, x.tip]), ...(c.choosing || []), ...c.bullets, ...(c.costFactors || []), ...c.steps.flatMap((s) => [s.title, s.text]), ...c.faqs.flatMap((f) => [f.q, f.a])].join(" ");
  const words = body.split(/\s+/).filter(Boolean).length;
  const all = `${title} ${meta} ${c.headline} ${body}`;
  const has = (s: string, w: string) => s.toLowerCase().includes(w);
  const checks: { name: string; ok: boolean; tip: string; w: number }[] = [
    { name: `Enough content (${words} words)`, ok: words >= 1200, tip: "Aim for 1,200+ words of useful local copy. Expand the intro, local conditions, repair-or-replace guidance or FAQs.", w: 15 },
    { name: `Title length (${title.length} chars)`, ok: title.length >= 30 && title.length <= 62, tip: "Keep the SEO title between 30 and 60 characters so Google shows it in full.", w: 10 },
    { name: "Title has keyword and city", ok: has(title, kwCore) && has(title, town), tip: `Put "${kw}" and "${p.city.split(",")[0]}" in the SEO title.`, w: 12 },
    { name: `Meta description length (${meta.length} chars)`, ok: meta.length >= 110 && meta.length <= 160, tip: "Write a 110-160 character meta description with a reason to call.", w: 8 },
    { name: "Meta description has keyword or city", ok: has(meta, kwCore) || has(meta, town), tip: "Mention the service or city in the meta description.", w: 5 },
    { name: "Main heading has keyword and city", ok: has(c.headline, kwCore) && has(c.headline, town), tip: `The H1 should include "${kw}" and the city.`, w: 10 },
    { name: "Intro mentions keyword early", ok: has((c.intro || "").slice(0, 220), kwCore), tip: "Use the main keyword in the first sentence or two of the intro.", w: 8 },
    { name: `FAQs (${c.faqs.length})`, ok: c.faqs.length >= 6, tip: "Have at least 6 FAQs. They can show up as rich results and answer real searches.", w: 8 },
    { name: `Nearby areas listed (${c.areas.length})`, ok: c.areas.length >= 6, tip: "List 6+ real neighborhoods or suburbs you serve.", w: 6 },
    { name: "Tracking number on the page", ok: p.phone.replace(/\D/g, "").length >= 10, tip: "Add a 10-digit tracking number so every call button works.", w: 8 },
    { name: "Hero photo", ok: !!p.photo, tip: "Pages with a relevant image tend to keep visitors longer. Add an AI photo when you build the page.", w: 4 },
    { name: "Follows listing rules (no \"free\", no prices)", ok: !/\bfree\b/i.test(all) && !/\$\s?\d/.test(all), tip: "Remove the word \"free\" and any dollar amounts from the copy.", w: 6 },
  ];
  const total = checks.reduce((a, x) => a + x.w, 0);
  const got = checks.reduce((a, x) => a + (x.ok ? x.w : 0), 0);
  return { score: Math.round((got / total) * 100), words, checks: checks.map(({ w, ...rest }) => rest) };
}
