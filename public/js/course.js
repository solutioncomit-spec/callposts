// CallPosts course: five short lessons from zero to a first ranking site.
// Each lesson ends with an action that opens the right tool. Plain HTML strings, written by CallPosts.
window.COURSE = [
  {
    id: "how",
    title: "How local lead generation makes money",
    minutes: 6,
    summary: "Where the money comes from, how long it takes, and the rules that keep you in business.",
    body: `
<p>Local lead generation means building websites that show up on Google when homeowners search for a service in their city, like “water heater repair Aurora”. When someone calls the number on your site, that call is worth money to a business that does the work.</p>
<h4>Two ways to earn</h4>
<ul>
<li><b>Pay-per-call networks.</b> A network gives you a tracking number and pays you for each qualified call it receives. Payouts depend on the service and city; the payout table in CallPosts shows reported rates of roughly $15 to $41 per qualified call for common home services.</li>
<li><b>Rank and rent.</b> Once a site ranks and gets calls, you rent it to one local contractor for a monthly fee and point the number to them.</li>
</ul>
<h4>How long it takes</h4>
<p>Be patient: a new site usually needs <b>3 to 6 months</b> to rank, and some markets are too competitive to win at all. That's why you build in several smaller markets instead of betting on one big city. Nobody can promise you income from this, and you should be wary of anyone who does.</p>
<h4>The rules</h4>
<ul>
<li>Say plainly that you're a referral service that connects homeowners with independent providers. Never pretend to be the contractor.</li>
<li>No fake reviews, ratings, licences or guarantees. No “free” offers and no prices.</li>
<li>Follow your network's traffic rules. Some don't accept certain sources or regions.</li>
</ul>
<h4>Can I do this from outside the US?</h4>
<p>Yes for websites: a site ranks for a US city no matter where you live. Before you build, check that your network accepts publishers from your country; most will ask for a tax form (W-8BEN for non-US individuals). Facebook Marketplace posting is different: it only works if you're actually in the area, so it's not a route for people outside the US.</p>`,
    action: { label: "Got it, next lesson", tool: null },
  },
  {
    id: "niche",
    title: "Choose a service and a city",
    minutes: 8,
    summary: "Pick a market you can actually win, and make sure someone will pay for its calls.",
    body: `
<h4>Pick the service</h4>
<p>Look for services where homeowners call fast or where jobs are big: water heaters, water damage, heating and AC, roofing, mold, septic, plumbing. People with a flooded basement call; they don't browse.</p>
<h4>Pick the city</h4>
<p>Start with mid-size cities and suburbs (roughly 50,000 to 300,000 people). “Water heater repair Los Angeles” is a war; “water heater repair Lakewood” is a chance. Plan one service across 5 to 10 nearby towns, or 2 to 4 related services (like water heaters and drain cleaning) across a few towns: either becomes one site.</p>
<h4>The 10-minute competition check</h4>
<p>Search “service + city” on Google and look at the first page:</p>
<ul>
<li><b>Good sign:</b> directories (Yelp, Angi, HomeAdvisor), thin or outdated sites, pages that don't even mention the city.</li>
<li><b>Hard market:</b> many strong local company sites with lots of pages and hundreds of reviews.</li>
</ul>
<h4>Check there's a buyer</h4>
<p>Before you build, confirm your network pays for that service in that area. The payout table in CallPosts lists markets with reported rates; your network dashboard has the current ones.</p>
<p class="tip">Write down: 1 service, 5 to 10 towns, and the network that will buy the calls.</p>`,
    action: { label: "Pick from the payout table", tool: "posts" },
  },
  {
    id: "build",
    title: "Build your first city site",
    minutes: 10,
    summary: "One service, five towns, one hub page, all linked together.",
    body: `
<ol>
<li>Get a tracking number for your service from your network. One number for the whole site is fine.</li>
<li>In the brief, type the service and paste the tracking number.</li>
<li>Open <b>Landing pages</b>, choose <b>Full site</b>, list your service (or up to 5 related services) and your towns, one per line, like “Lakewood, CO”. Add 2 blog posts if you like.</li>
<li>Pick a theme. Emergency suits leaks and floods; Meadow suits lawn and pest; Clean works for anything.</li>
<li>Build. Each city page costs 3 credits (6 with an AI photo) and takes about 20 to 30 seconds.</li>
</ol>
<h4>After it's built</h4>
<ul>
<li>Read every page. You're responsible for what it says; fix anything that isn't right for that town using <b>Edit</b>.</li>
<li>Run a <b>Site audit</b> on the hub page and aim for 85 or more.</li>
</ul>`,
    action: { label: "Open the city site builder", tool: "sites-city" },
  },
  {
    id: "domain",
    title: "Put it on your own domain",
    minutes: 10,
    summary: "A domain you own builds authority you keep, and you need one to rent the site out.",
    body: `
<ol>
<li><b>Buy a domain</b> (usually $10 to $15 a year) at a registrar such as Cloudflare, Namecheap or Porkbun. Simple names work: region + service, like lakewoodwaterheaterhelp.com. Never use a real company's name or trademark.</li>
<li><b>Add one DNS record</b> at the registrar: type <b>CNAME</b>, name <code>www</code>, value <code>callposts.netlify.app</code>.</li>
<li><b>Connect it</b> in Landing pages: open your site, choose “Connect your own domain”, enter www.yourdomain.com and click Connect. HTTPS is set up automatically within minutes.</li>
<li><b>Tell Google.</b> Add the domain to Google Search Console (free), verify it with the TXT record it gives you, then submit <code>/sitemap.xml</code>.</li>
</ol>
<p class="tip">DNS changes can take from a few minutes to an hour. If Connect says no record yet, wait and try again.</p>`,
    action: { label: "Open my sites", tool: "sites" },
  },
  {
    id: "grow",
    title: "Get found, get calls, get paid",
    minutes: 8,
    summary: "What to do in the months while your site climbs, and how to turn calls into income.",
    body: `
<h4>Get found</h4>
<ul>
<li>Click <b>Submit to search engines</b> on your site; new pages are also submitted automatically.</li>
<li>Check Google Search Console every week: which searches show your pages, and where they rank.</li>
<li>Don't create a Google Business Profile for a referral site. Google requires a real business at a real address, and fake listings get suspended.</li>
</ul>
<h4>Get calls</h4>
<ul>
<li>Fix whatever the <b>Site audit</b> flags; call buttons near the top and on every section matter.</li>
<li>When a page starts getting impressions, improve it: answer more questions, add local detail.</li>
</ul>
<h4>Get paid</h4>
<ul>
<li><b>Network:</b> calls to your tracking number are paid at the network's rate once they qualify.</li>
<li><b>Rank and rent:</b> when a site brings steady calls, contact local contractors, show them the call numbers, and offer the site for a monthly fee.</li>
</ul>
<h4>Repeat what works</h4>
<p>Expand the services and towns that bring calls; drop what doesn't after a fair test. That's the whole business.</p>`,
    action: { label: "Run a site audit", tool: "audit" },
  },
];
