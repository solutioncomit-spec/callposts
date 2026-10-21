// Curated list of pay-per-call networks that buy home-service calls. Hand-maintained by CallPosts.
// "verified": facts below were read on the network's own page on `checked`.
// "listed": the network appears in public pay-per-call roundups as covering home services; confirm on their site.
// Never list payout rates as promises, and never claim a network endorses CallPosts.
export type Network = {
  name: string; url: string; status: "verified" | "listed"; checked: string;
  verticals: string; model: string; who: string; traffic: string; notes: string;
};

export const NETWORKS_CHECKED = "2026-10-21";

export const NETWORKS: Network[] = [
  {
    name: "Lead Smart", url: "https://leadsmartinc.com/affiliate-program", status: "verified", checked: "2026-10-21",
    verticals: "Home services and other industries",
    model: "Pay per qualified call; rates shown in your publisher dashboard",
    who: "Publishers with US home-service traffic; ask them about your country before applying",
    traffic: "Ask for their current traffic rules per offer",
    notes: "CallPosts' network-rule checks use Lead Smart's publisher guidance. CallPosts is independent and not endorsed by Lead Smart.",
  },
  {
    name: "Service Direct", url: "https://servicedirect.com/pay-per-lead-affiliate-program/", status: "verified", checked: "2026-10-21",
    verticals: "Plumbing, HVAC, roofing, electrician, locksmith, pest control, solar and more; also auto, insurance and medical",
    model: "Dynamic per-call pricing based on live advertiser demand; static tracking number or ping/post API",
    who: "Affiliates with US call traffic",
    traffic: "Paid search, display, social, content, email and influencer fit well. Free marketplace directories (Craigslist, Facebook Marketplace and others) are prohibited.",
    notes: "Don't send Marketplace calls here. Use SEO sites or paid traffic instead.",
  },
  {
    name: "eLocal", url: "https://elocal.com/affiliate-contact", status: "verified", checked: "2026-10-21",
    verticals: "50+ verticals including home services, dental, legal and auto insurance",
    model: "Competitive bidding: higher payouts in high-demand areas; per-call payouts in your dashboard",
    who: "Experienced pay-per-call affiliates; the questionnaire asks for a US or Canadian address and entity type. They say they're highly selective.",
    traffic: "Search, social, targeted display, native and offline media; a monthly call minimum applies",
    notes: "Better once you have call volume to show. Apply with numbers from your existing sites.",
  },
  {
    name: "Marketcall", url: "https://www.marketcall.com/affiliates", status: "listed", checked: "2026-10-21",
    verticals: "Home services and home improvement among many categories",
    model: "Varies by offer", who: "Check on their site", traffic: "Check per offer", notes: "",
  },
  {
    name: "Astoria Company", url: "https://astoriacompany.com/publishers/phone-numbers/", status: "listed", checked: "2026-10-21",
    verticals: "Household and professional services among other verticals",
    model: "Varies by offer", who: "US traffic offers", traffic: "Check per offer", notes: "",
  },
  {
    name: "RingPartner", url: "https://www.ringpartner.com/affiliate-program/", status: "listed", checked: "2026-10-21",
    verticals: "Home services among other verticals",
    model: "Varies by offer", who: "Check on their site", traffic: "Check per offer", notes: "",
  },
  {
    name: "PX", url: "https://cds.px.com/publisherregister/", status: "listed", checked: "2026-10-21",
    verticals: "Household services, finance and insurance",
    model: "Varies by vertical", who: "Check on their site", traffic: "Check per offer", notes: "",
  },
  {
    name: "Goojibear", url: "https://goojibear.invoca.net/organizations/new", status: "listed", checked: "2026-10-21",
    verticals: "Household and professional services, such as pest control",
    model: "Varies by offer", who: "Roundups disagree on international publishers; confirm before applying", traffic: "Check per offer", notes: "",
  },
  {
    name: "Ring on Demand", url: "https://ringondemand.com/partners/join-as-publisher", status: "listed", checked: "2026-10-21",
    verticals: "Pay-per-call, exclusive leads and pay-per-appointment",
    model: "Varies by offer", who: "Check on their site", traffic: "Check per offer", notes: "",
  },
];

export const OFFERVAULT_URL = "https://www.offervault.com/";
