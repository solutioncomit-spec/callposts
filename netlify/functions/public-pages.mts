import type { Config } from "@netlify/functions";
import { NETWORKS, NETWORKS_CHECKED, OFFERVAULT_URL, type Network } from "../lib/networks.mts";

// Public, indexable pages that bring people in without an account:
//   /free-audit        quick SEO check of any page (no sign-up)
//   /learn, /learn/:id the pay-per-call course, one page per lesson
//   /networks          networks that buy home-service calls, and how to apply
//   /api/networks      the same list as JSON for the app
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function shell(o: { path: string; title: string; desc: string; body: string; schema?: unknown; script?: string }) {
  const url = `https://callposts.com${o.path}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:image" content="https://callposts.com/img/water-heater.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem("cp-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Sora:wght@400;500;600&display=swap">
${o.schema ? `<script type="application/ld+json">${JSON.stringify(o.schema).replace(/</g, "\\u003c")}</script>` : ""}
<style>
*,*::before,*::after{box-sizing:border-box}body{margin:0}
:root{color-scheme:light;--bg:#f5f7ff;--surface:rgba(255,255,255,.85);--ink:#0b1030;--muted:#56618a;--line:rgba(60,80,160,.16);--brand:#0a8fb0;--brand-ink:#fff;--soft:rgba(10,143,176,.08);--good:#15803d;--warn:#b45f00;--bad:#b91c1c;--field:#fff;--display:"Unbounded",system-ui,sans-serif;--body:"Sora",system-ui,sans-serif}
:root[data-theme="dark"]{color-scheme:dark;--bg:#070912;--surface:rgba(16,22,42,.8);--ink:#e8ecff;--muted:#93a0c9;--line:rgba(130,165,255,.18);--brand:#4ff0ff;--brand-ink:#04121a;--soft:rgba(79,240,255,.08);--good:#4ade80;--warn:#fbbf24;--bad:#f87171;--field:rgba(5,8,20,.7)}
body{background:var(--bg);color:var(--ink);font:16px/1.6 var(--body)}
a{color:var(--brand)}
.wrap{max-width:980px;margin:0 auto;padding:0 16px}
nav{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:18px 0}
.logo{font:800 20px var(--display);color:var(--ink);text-decoration:none}.logo span{color:var(--brand)}
.links{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:14px}.links a{color:var(--muted);text-decoration:none}.links a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;gap:8px;font:600 15px var(--body);text-decoration:none;border-radius:8px;padding:11px 16px;border:1px solid transparent;cursor:pointer;background:var(--brand);color:var(--brand-ink)}
.btn.sec{background:transparent;color:var(--ink);border-color:var(--line)}
.links .btn{color:var(--brand-ink);padding:8px 12px;font-size:14px}
h1,h2,h3{font-family:var(--display);letter-spacing:-.015em;margin:0;text-wrap:balance}
h1{font-size:clamp(30px,5vw,48px);line-height:1.08;font-weight:800}h2{font-size:clamp(22px,3vw,28px);line-height:1.15;margin-top:8px}h3{font-size:17px;font-weight:700}
.lede{color:var(--muted);font-size:18px;max-width:62ch;margin:12px 0 0}
main{display:flex;flex-direction:column;gap:28px;padding:20px 0 56px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px}
.muted{color:var(--muted)}.small{font-size:13px;color:var(--muted)}
.tag{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;border:1px solid var(--line)}
.tag.v{color:var(--good);border-color:currentColor}.tag.l{color:var(--warn);border-color:currentColor}
dl{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;margin:0;font-size:14px}dt{color:var(--muted)}dd{margin:0}
input{font:15px var(--body);padding:11px 12px;border-radius:8px;border:1px solid var(--line);background:var(--field);color:var(--ink);width:100%}
.row{display:flex;gap:8px;flex-wrap:wrap}.row>*{flex:1 1 200px}
.cta{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.lesson h4{font-family:var(--display);font-size:16px;margin:18px 0 6px}.lesson p,.lesson li{max-width:68ch}.lesson .tip{background:var(--soft);border-radius:8px;padding:10px 12px}
ol.idx{display:flex;flex-direction:column;gap:10px;padding-left:22px;margin:0}
.score{font:800 44px var(--display);line-height:1}.bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden;flex:1}.bar i{display:block;height:100%}
.g{display:flex;gap:10px;align-items:center;font-size:14px}.g span:first-child{width:170px;flex:none}
.checks li{list-style:none;display:flex;gap:8px;padding:4px 0;font-size:14px}.checks ul{padding:0;margin:0}
footer{border-top:1px solid var(--line);padding:24px 0 40px;font-size:13px;color:var(--muted)}footer a{color:inherit}
@media (max-width:560px){.g span:first-child{width:120px}dl{grid-template-columns:1fr}dt{margin-top:6px}}
</style></head><body><div class="wrap">
<nav><a class="logo" href="/">Call<span>Posts</span></a><div class="links"><a href="/app#sites">Site builder</a><a href="/free-audit">Free SEO check</a><a href="/learn">Learn</a><a href="/networks">Networks</a><a class="btn" href="/app">Try 15 free credits</a></div></nav>
<main>${o.body}</main>
<footer>CallPosts is an independent tool, not affiliated with or endorsed by any network listed here, or by Meta. Networks manage their own approvals, tracking numbers and payouts. Nothing here promises income. · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></footer>
</div>${o.script ? `<script>${o.script}</script>` : ""}</body></html>`;
}

const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });

// ---------- Networks ----------
function networkCard(n: Network) {
  return `<article class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h3>${esc(n.name)}</h3>
<span class="tag ${n.status === "verified" ? "v" : "l"}">${n.status === "verified" ? `Checked on their site ${fmtDate(n.checked)}` : "Listed in public roundups · confirm"}</span></div>
<dl><dt>Verticals</dt><dd>${esc(n.verticals)}</dd><dt>How it pays</dt><dd>${esc(n.model)}</dd><dt>Who can join</dt><dd>${esc(n.who)}</dd><dt>Traffic</dt><dd>${esc(n.traffic)}</dd></dl>
${n.notes ? `<p class="small" style="margin:0">${esc(n.notes)}</p>` : ""}
<a class="btn sec" href="${esc(n.url)}" target="_blank" rel="noopener nofollow" style="align-self:flex-start">Apply on ${esc(n.name)}'s site ↗</a></article>`;
}
function networksPage() {
  const v = NETWORKS.filter((n) => n.status === "verified"), l = NETWORKS.filter((n) => n.status === "listed");
  const faqs = [
    ["Can I join a pay-per-call network from outside the US?", "Some networks accept international publishers and some don't. Most ask non-US individuals for a W-8BEN tax form. Ask each network before you build sites for its offers."],
    ["Which traffic can I send?", "Every network sets its own rules, often per offer. Some prohibit free marketplace listings such as Facebook Marketplace; SEO websites are widely accepted. Get the rules in writing before you start."],
    ["How much does a call pay?", "It depends on the service, the city, the time and live buyer demand, and only qualified calls are paid. Networks show current rates in your dashboard; treat any public figure as a rough reference."],
  ];
  return shell({
    path: "/networks",
    title: "Pay-per-call networks for home services: where to apply · CallPosts",
    desc: "Networks that buy home-service phone calls, what they pay for, who they accept and which traffic they allow, checked against their own pages. Plus what to prepare before you apply.",
    schema: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    body: `<header><h1>Pay-per-call networks that buy home-service calls</h1>
<p class="lede">Where to apply once you have a site, what each network pays for, and which traffic it allows. We check each network's own page and date every entry. Rules and payouts change, so confirm with the network before you build.</p></header>
<section style="display:flex;flex-direction:column;gap:14px"><h2>Checked on the network's own site</h2><div class="grid">${v.map(networkCard).join("")}</div></section>
<section style="display:flex;flex-direction:column;gap:14px"><h2>Also worth a look</h2><p class="muted" style="margin:0">These appear in public pay-per-call network roundups as covering home services. We haven't confirmed the details on their own sites yet.</p><div class="grid">${l.map(networkCard).join("")}</div></section>
<section class="card"><h2>Search more offers</h2><p style="margin:0">OfferVault is a public directory of affiliate offers. Search “pay per call” plus your service to see more networks and offers, then check each network's rules yourself.</p><a class="btn sec" href="${OFFERVAULT_URL}" target="_blank" rel="noopener nofollow" style="align-self:flex-start">Search OfferVault ↗</a></section>
<section class="card"><h2>Before you apply</h2><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
<li><b>Have a live site.</b> Networks approve publishers faster when they can see real pages for the service and cities you want. <a href="/app#sites">Build one in CallPosts</a>.</li>
<li><b>Know your traffic source.</b> Say exactly where calls will come from (SEO site, paid search, social). Never send traffic a network prohibits.</li>
<li><b>Be honest about volume.</b> New publishers start small. Numbers from even a few weeks of a live site help.</li>
<li><b>Prepare tax and payment details.</b> US networks usually ask non-US individuals for a W-8BEN and pay by wire, ACH or PayPal.</li>
<li><b>Get the offer rules in writing.</b> Allowed areas, call hours, minimum call length and banned wording differ per offer.</li></ol></section>
<section class="card"><h2>Questions</h2>${faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p style="margin:0">${esc(a)}</p>`).join("")}</section>
<div class="cta"><h2>Build the site first</h2><p style="margin:0">Create service-and-city pages with your tracking number, check them with the SEO audit, then apply with a live URL.</p><a class="btn" href="/app#sites">Try 15 free credits</a><span class="small">No card required. List last reviewed ${fmtDate(NETWORKS_CHECKED)}.</span></div>`,
  });
}

// ---------- Learn ----------
type Lesson = { id: string; title: string; minutes: number; summary: string; body: string; action: { label: string; tool: string | null } };
async function course(origin: string): Promise<Lesson[]> {
  const r = await fetch(`${origin}/js/course.js`);
  const w: any = {};
  new Function("window", await r.text())(w);
  return w.COURSE || [];
}
const toolHref = (t: string | null) => (t === "networks" ? "/networks" : t === "audit" ? "/free-audit" : t ? `/app#${t}` : "/app");
function learnIndex(lessons: Lesson[]) {
  const mins = lessons.reduce((a, l) => a + l.minutes, 0);
  return shell({
    path: "/learn",
    title: "Learn pay-per-call for home services: a short course · CallPosts",
    desc: `A ${lessons.length}-lesson course on earning from home-service pay-per-call: how it pays, choosing a service and city, building a site, your own domain, getting calls and finding a network.`,
    schema: { "@context": "https://schema.org", "@type": "Course", name: "Pay-per-call for home services", description: "From zero to a published lead generation site and a network to send calls to.", provider: { "@type": "Organization", name: "CallPosts", sameAs: "https://callposts.com" } },
    body: `<header><h1>Learn pay-per-call for home services</h1><p class="lede">${lessons.length} short lessons, about ${mins} minutes in total. Read them here; each one ends with the CallPosts tool that does the step. Nobody can promise income from this, and these lessons don't.</p></header>
<ol class="idx">${lessons.map((l) => `<li><a href="/learn/${esc(l.id)}"><b>${esc(l.title)}</b></a> <span class="small">· ${l.minutes} min</span><br><span class="muted">${esc(l.summary)}</span></li>`).join("")}</ol>
<div class="cta"><h2>Do it as you learn</h2><p style="margin:0">Your account tracks lesson progress and opens the right tool at each step.</p><a class="btn" href="/app#learn">Try 15 free credits</a><span class="small">No card required.</span></div>`,
  });
}
function lessonPage(lessons: Lesson[], i: number) {
  const l = lessons[i], prev = lessons[i - 1], next = lessons[i + 1];
  return shell({
    path: `/learn/${l.id}`,
    title: `${l.title} · Pay-per-call course · CallPosts`,
    desc: l.summary,
    schema: { "@context": "https://schema.org", "@type": "Article", headline: l.title, description: l.summary, isPartOf: { "@type": "Course", name: "Pay-per-call for home services", url: "https://callposts.com/learn" } },
    body: `<header><p class="small" style="margin:0"><a href="/learn">Course</a> · Lesson ${i + 1} of ${lessons.length} · ${l.minutes} min</p><h1 style="margin-top:6px">${esc(l.title)}</h1><p class="lede">${esc(l.summary)}</p></header>
<article class="card lesson">${l.body}</article>
<div class="cta"><b>Next step</b><a class="btn" href="${toolHref(l.action.tool)}">${esc(l.action.tool ? l.action.label : "Open CallPosts")}</a><span class="small">New accounts start with 15 credits. No card required.</span></div>
<div class="row" style="justify-content:space-between">${prev ? `<a class="btn sec" href="/learn/${esc(prev.id)}" style="flex:0 1 auto">← ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a class="btn sec" href="/learn/${esc(next.id)}" style="flex:0 1 auto">${esc(next.title)} →</a>` : ""}</div>`,
  });
}

// ---------- Free audit ----------
function auditPage() {
  const script = `
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const col=n=>n>=85?"var(--good)":n>=65?"var(--warn)":"var(--bad)";
async function run(){const url=$("u").value.trim();if(!url){$("u").focus();return}
  $("go").disabled=true;$("msg").textContent="Checking… about 5–15 seconds";$("out").innerHTML="";
  try{const r=await fetch("/api/free-audit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url,keyword:$("k").value.trim(),city:$("c").value.trim()})});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok){$("msg").innerHTML=esc(j.error||"The check didn't finish. Try again.")+(j.limit?' <a href="/app">Create an account</a>':"");return}
    const rep=j.report,by={};rep.checks.forEach(c=>(by[c.group]=by[c.group]||[]).push(c));const bad=rep.checks.filter(c=>!c.ok);
    $("msg").textContent=j.left>0?j.left+" quick check"+(j.left===1?"":"s")+" left today.":"That was today's last quick check.";
    $("out").innerHTML='<div class="card"><div style="display:flex;gap:14px;align-items:center"><span class="score" style="color:'+col(rep.score)+'">'+rep.score+'</span><div><b style="overflow-wrap:anywhere">'+esc(rep.finalUrl)+'</b><div class="small">'+bad.length+' of '+rep.checks.length+' checks need work · loaded in '+(rep.ms/1000).toFixed(2)+' s</div></div></div>'
      +rep.groups.map(g=>'<div class="g"><span>'+esc(g.name)+'</span><span class="bar"><i style="width:'+g.score+'%;background:'+col(g.score)+'"></i></span><b>'+g.score+'</b></div>').join("")+'</div>'
      +(bad.length?'<div class="card"><h2>What to fix</h2><ul class="checks" style="padding:0;margin:0">'+bad.map(c=>'<li><span style="color:var(--bad)">✕</span><span><b>'+esc(c.name)+'</b> <span class="small">'+esc(c.found)+'</span><br>'+esc(c.tip)+'</span></li>').join("")+'</ul></div>':"")
      +'<details class="card"><summary style="cursor:pointer"><b>All '+rep.checks.length+' checks</b></summary>'+Object.entries(by).map(([g,cs])=>'<h3 style="margin-top:10px">'+esc(g)+'</h3><ul class="checks">'+cs.map(c=>'<li><span style="color:'+(c.ok?"var(--good)":"var(--bad)")+'">'+(c.ok?"✓":"✕")+'</span><span><b>'+esc(c.name)+'</b> <span class="small">'+esc(c.found)+'</span></span></li>').join("")+'</ul>').join("")+'</details>'
      +'<div class="cta"><h2>Want a page that passes?</h2><p style="margin:0">CallPosts builds service-and-city pages with tap-to-call, local copy, schema and a sitemap, and the full audit adds an AI fix plan written for your page.</p><a class="btn" href="/app#sites">Try 15 free credits</a><span class="small">No card required. A higher score doesn\\'t guarantee rankings or calls.</span></div>';
  }catch(e){$("msg").textContent="The check didn't finish. Try again."}finally{$("go").disabled=false}}
$("go").onclick=run;["u","k","c"].forEach(id=>$(id).addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run()}}));
const q=new URLSearchParams(location.search).get("url");if(q){$("u").value=q}`;
  return shell({
    path: "/free-audit",
    title: "Free local SEO check for home-service websites · CallPosts",
    desc: "Check any web page for local SEO basics, tap-to-call, schema, speed and disclosures in seconds. No sign-up. Built for home-service lead generation sites.",
    schema: { "@context": "https://schema.org", "@type": "WebApplication", name: "CallPosts free SEO check", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: "https://callposts.com/free-audit" },
    script,
    body: `<header><h1>Free local SEO check</h1><p class="lede">Paste any page: yours, a client's or the site ranking above you. We run about 30 checks for local SEO, tap-to-call, schema, speed and disclosures, and show exactly what to fix. No sign-up for 3 checks a day.</p></header>
<section class="card"><input id="u" type="url" inputmode="url" placeholder="https://example.com/water-heater-repair-aurora" aria-label="Page address">
<div class="row"><input id="k" placeholder="Target service (optional)" aria-label="Target service"><input id="c" placeholder="City, State (optional)" aria-label="Target city"></div>
<button class="btn" id="go" type="button" style="align-self:flex-start">Check this page</button><span class="small" id="msg" role="status"></span></section>
<div id="out" style="display:flex;flex-direction:column;gap:14px" aria-live="polite"></div>
<section class="card"><h2>What we check</h2><div class="grid" style="font-size:14px">
<div><b>On-page SEO</b><br><span class="muted">Title, meta description, one clear H1, sections, word count, service and city in the right places, alt text, internal links.</span></div>
<div><b>Calls</b><br><span class="muted">Tap-to-call links, a call button near the top and repeated down the page, the number written as text.</span></div>
<div><b>Local and schema</b><br><span class="muted">JSON-LD, LocalBusiness or Service schema, FAQ schema.</span></div>
<div><b>Technical</b><br><span class="muted">HTTPS, status, indexability, canonical, mobile viewport, response time, page weight, scripts, sitemap, robots.txt.</span></div>
<div><b>Disclosures and claims</b><br><span class="muted">Referral disclosure, privacy link, and wording call buyers flag: “free” offers and prices.</span></div>
</div></section>`,
  });
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (p === "/api/networks") return Response.json({ networks: NETWORKS, checked: NETWORKS_CHECKED, offervault: OFFERVAULT_URL }, { headers: { "cache-control": "public, max-age=300" } });
  if (p === "/networks") return html(networksPage());
  if (p === "/free-audit") return html(auditPage());
  if (p === "/learn" || p.startsWith("/learn/")) {
    const lessons = await course(url.origin).catch(() => [] as Lesson[]);
    if (p === "/learn") return html(learnIndex(lessons));
    const i = lessons.findIndex((l) => l.id === p.slice(7));
    if (i >= 0) return html(lessonPage(lessons, i));
    return new Response("Lesson not found", { status: 404 });
  }
  return new Response("Not found", { status: 404 });
};

export const config: Config = {
  path: ["/networks", "/free-audit", "/learn", "/learn/*", "/api/networks"],
  method: ["GET"],
};
