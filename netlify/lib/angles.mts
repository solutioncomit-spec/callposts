// Listing styles ("angles"). Each one changes the hook, structure and tone of a listing.
// The names are shown in the app; the guide is what the AI follows. All styles still obey the listing rules.

export const ANGLES: { name: string; guide: string }[] = [
  { name: "Same-day / emergency", guide: "Lead with urgency: a leak, no heat, no hot water, a broken unit. Short sentences, call to action first. Never promise a response time or arrival window." },
  { name: "Quick quote", guide: "Lead with how easy it is to get an exact quote by phone. Emphasise one quick call, no running around. Never mention a price." },
  { name: "Seasonal / weather", guide: "Tie the service to the current season and the city's weather (heat, freezes, storms, humidity, monsoon). Explain why now is the right time." },
  { name: "Cost-saving / financing", guide: "Lead with avoiding bigger repair bills and wasted energy, and mention that pros can talk through options. Never state prices, discounts, percentages or financing terms." },
  { name: "Local & trusted", guide: "Lead with local: name the city and nearby neighborhoods, local homes and conditions, and connecting with pros who work in the area." },
  { name: "Warning signs", guide: "Open with a short list (3-5 lines) of signs a homeowner needs this service, then the call to action. Practical and specific." },
  { name: "Question hook", guide: "Open the title and first line with a direct question the homeowner is asking themselves (e.g. 'Water heater making noises?'). Answer it in two sentences, then call." },
  { name: "Repair or replace?", guide: "Frame the listing around the repair-versus-replace decision. Say a local pro can look at the situation and explain the options on the call." },
  { name: "Before winter / season prep", guide: "Frame as getting ahead of the next season: inspections, tune-ups and fixes before problems hit. Calm, planning tone." },
  { name: "New homeowner", guide: "Speak to people who just bought or moved into a home and want things checked or upgraded. Friendly and reassuring." },
  { name: "Landlords & property managers", guide: "Speak to landlords and property managers who need dependable help for rentals and tenants. Businesslike, no fluff." },
  { name: "Short & punchy", guide: "Very short: a punchy title, 3-5 one-line sentences, phone number. Ideal for scrolling on mobile. Stay within 60-90 words." },
  { name: "Homeowner story", guide: "Open with a short, relatable everyday scenario (no named people, no fake testimonial), then explain how one call connects them with a local pro." },
  { name: "Checklist", guide: "Use a simple checklist of what the pro can help with (5-7 lines starting with a dash), then the call to action." },
  { name: "Upgrade & value", guide: "Frame the service as a home upgrade: comfort, looks, efficiency and home value. Aspirational but honest, no numbers or claims about return." },
];

export const ANGLE_NAMES = ANGLES.map((a) => a.name);

export function angleGuide(name?: string): string {
  const a = ANGLES.find((x) => x.name.toLowerCase() === String(name || "").toLowerCase());
  if (a) return `${a.name}. ${a.guide}`;
  return `Mix of styles. Give each listing a different style from this list, in this order of preference, so no two read alike:\n${ANGLES.map((x) => `- ${x.name}: ${x.guide}`).join("\n")}`;
}
