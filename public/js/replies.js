// Message and reply packs for every home-service vertical CallPosts supports. Written by CallPosts; no AI, no credits.
// Each service maps to a group with its own qualifying questions, price factors and urgency. Templates use
// {service}, {city}, {phone} and {brand}; the app fills them from the brief.
// Rules every template follows: no prices or quotes, no "free", no claims of being the contractor, no licence,
// insurance or guarantee claims, and safety first for gas, electrical and water hazards.
(function () {
  const G = {
    water: {
      name: "Water, mold and restoration",
      urgent: true,
      safety: "If water is near outlets or the electrical panel, stay out of the area and shut off power at the breaker only if it's safe to reach. For sewage or biohazards, keep children and pets away.",
      questions: ["Is the water still coming in, or has it stopped?", "Which rooms or floors are affected?", "Do you know the source (pipe, appliance, roof, flooding)?"],
      factors: ["how much area is affected", "what's wet (drywall, flooring, contents)", "drying equipment and days needed", "whether testing or removal is required"],
      opener: "Water and mold damage get worse by the hour, so it's worth talking to someone today.",
    },
    plumbing: {
      name: "Plumbing and water heaters",
      urgent: true,
      safety: "If you smell gas near a gas water heater, leave the home and call your gas utility from outside. For a burst pipe, shut off the main water valve.",
      questions: ["What's happening right now (leak, no hot water, clog, low pressure)?", "How old is the fixture or water heater, roughly?", "Is it gas, electric or tankless (for water heaters)?"],
      factors: ["repair versus replacement", "access to the pipes or unit", "parts and model", "permits where your city requires them"],
      opener: "Plumbing problems are much easier to sort out on a quick call than over messages.",
    },
    septic: {
      name: "Septic",
      urgent: false,
      safety: "If sewage is backing up into the home, stop using water and keep everyone away from the affected area.",
      questions: ["When was the tank last pumped, if you know?", "Any backups, slow drains, odors or soggy ground over the field?", "Do you need an inspection for a home sale?"],
      factors: ["tank size and access", "how long since the last pumping", "whether the drain field needs work", "inspection requirements in your county"],
      opener: "Septic questions depend a lot on your tank and yard, so a quick call helps.",
    },
    hvac: {
      name: "Heating and cooling",
      urgent: true,
      safety: "If you smell gas or your carbon monoxide alarm goes off, leave the home and call your gas utility or 911 from outside.",
      questions: ["Is it not running at all, running but not heating or cooling, or making noise?", "How old is the system, roughly?", "What type is it (central, heat pump, furnace, boiler, mini-split, swamp cooler)?"],
      factors: ["repair versus replacement", "system type and size", "parts availability", "ductwork condition"],
      opener: "Heating and cooling issues are quicker to diagnose by phone first.",
    },
    electrical: {
      name: "Electrical, solar and security",
      urgent: false,
      safety: "If you see sparks, smell burning or an outlet is hot, switch off that circuit at the breaker and call 911 if there's smoke.",
      questions: ["What would you like done, and where in the home?", "How old is the electrical panel, if you know?", "Is this for a new install or fixing something existing?"],
      factors: ["panel capacity", "wiring distance and access", "equipment chosen", "permits and inspections"],
      opener: "Electrical work depends on your panel and wiring, so a call is the fastest way to get clear answers.",
    },
    exterior: {
      name: "Roofing, siding, windows and exterior",
      urgent: false,
      safety: "If a storm has left the roof open, cover what's below and stay off the roof yourself.",
      questions: ["Is this a repair or a full replacement?", "Any active leaks or storm damage?", "Roughly how big is the area or how many windows?"],
      factors: ["size of the job", "materials", "how many layers or what's underneath", "access and height"],
      opener: "Exterior jobs vary a lot with size and materials, so a call gets you real answers.",
    },
    structural: {
      name: "Foundation, concrete, decks and fences",
      urgent: false,
      safety: "If you see new wide cracks, doors that suddenly stick or a sagging floor, keep people off that area until it's checked.",
      questions: ["What are you seeing or planning (cracks, settling, new patio, deck or fence)?", "Roughly how big is the area?", "Is there a timeline, like a home sale?"],
      factors: ["size and depth of the work", "soil and drainage", "materials", "permits"],
      opener: "Structural and concrete work is easier to scope on a call.",
    },
    remodel: {
      name: "Remodeling and interiors",
      urgent: false,
      safety: "",
      questions: ["Which room or project, and what would you like to change?", "Do you have a rough timeline?", "Are you keeping the layout or moving things around?"],
      factors: ["size of the space", "materials and finishes", "layout changes", "plumbing or electrical changes"],
      opener: "Every remodel is different, so a quick call is the best way to talk through options.",
    },
    pest: {
      name: "Pest, termite and wildlife",
      urgent: false,
      safety: "Don't handle wild animals yourself, and keep children and pets away from any animal that seems sick or aggressive.",
      questions: ["What are you seeing (insects, droppings, noises, damage)?", "Where in or around the home?", "How long has it been going on?"],
      factors: ["type of pest or animal", "how widespread it is", "entry points to seal", "one-time versus ongoing treatment"],
      opener: "Pest problems spread fast, so it's worth getting it looked at soon.",
    },
    yard: {
      name: "Yard, trees and pools",
      urgent: false,
      safety: "If a tree or large limb is on a power line, stay well away and call your power company.",
      questions: ["What would you like done?", "Roughly how big is the yard, tree or area?", "One-time job or regular service?"],
      factors: ["size and access", "equipment needed", "haul-away", "how often"],
      opener: "Yard and tree jobs depend on size and access, so a short call helps.",
    },
    cleaning: {
      name: "Cleaning, junk removal and moving",
      urgent: false,
      safety: "",
      questions: ["What needs doing, and roughly how much (rooms, items, home size)?", "What date works for you?", "Any stairs or tricky access?"],
      factors: ["size of the job", "access and stairs", "date and timing", "special items"],
      opener: "These jobs are easiest to schedule on a quick call.",
    },
    doors: {
      name: "Garage doors and locks",
      urgent: true,
      safety: "Don't try to adjust garage door springs or cables yourself; they're under high tension.",
      questions: ["What's happening (won't open, off track, noisy, locked out, rekey)?", "Is a car stuck inside, or are you locked out right now?", "Repair, new door or new locks?"],
      factors: ["repair versus replacement", "parts needed", "door or lock type", "time of day"],
      opener: "Door and lock problems are fastest to solve by phone.",
    },
    appliance: {
      name: "Appliances",
      urgent: false,
      safety: "If a gas appliance smells of gas, turn it off if safe, leave the home and call your gas utility from outside.",
      questions: ["Which appliance, and what's it doing?", "Brand and rough age?", "Gas or electric?"],
      factors: ["appliance type and brand", "the part that failed", "repair versus replacement", "age"],
      opener: "Appliance problems are quicker to sort out with a short call.",
    },
  };

  const MAP = {
    "Water Damage Restoration": "water", "Sump Pumps": "water", "Basement Waterproofing": "water", "Crawl Space Repair": "water",
    "Mold Remediation": "water", "Mold Removal": "water", "Fire & Smoke Damage Restoration": "water", "Biohazard Cleanup": "water", "Toxic Lead Abatement": "water",
    "Plumbing": "plumbing", "Drain Cleaning": "plumbing", "Sewer/Water Main": "plumbing", "Water Heaters": "plumbing", "Tankless Water Heaters": "plumbing",
    "Water Softeners & Filtration": "plumbing", "Well Pump Repair": "plumbing", "Bathtub Installation": "plumbing", "Walk-in Tubs": "plumbing", "Shower Doors": "remodel",
    "Septic Inspection": "septic", "Septic Pumping": "septic", "Septic Repair": "septic",
    "Central AC": "hvac", "Central Heating": "hvac", "Furnace Repair": "hvac", "Boiler Repair": "hvac", "Heat Pumps": "hvac", "Mini-Split AC": "hvac",
    "Ducts & Vents": "hvac", "Swamp Cooler Repair": "hvac", "Insulation": "hvac",
    "Electrical Panel Upgrades": "electrical", "EV Charger Installation": "electrical", "Generator Installation": "electrical", "Ceiling Fan Installation": "electrical",
    "Outdoor Lighting": "electrical", "Solar Energy": "electrical", "Home Security Systems": "electrical",
    "Roof Repair": "exterior", "Roof Replacement": "exterior", "Gutters": "exterior", "Gutter Guards": "exterior", "Skylights": "exterior", "Chimney Repair": "exterior",
    "Vinyl Siding": "exterior", "Stucco Siding": "exterior", "Exterior Painting": "exterior", "Windows": "exterior", "Pressure Washing": "exterior",
    "Foundation Repair": "structural", "Concrete Foundations": "structural", "Concrete Work": "structural", "Retaining Walls": "structural", "Decks": "structural", "Fence Installation": "structural",
    "Additions & Remodeling": "remodel", "Bathroom Remodeling": "remodel", "Kitchen Remodeling": "remodel", "Cabinet Installation": "remodel", "Countertops": "remodel",
    "Tile Installation": "remodel", "Hardwood Flooring": "remodel", "Carpet Installation": "remodel", "Interior Painting": "remodel", "Handyman": "remodel",
    "Window Blinds": "remodel", "Window Draperies": "remodel",
    "Pest Control": "pest", "Bed Bug Treatment": "pest", "Termite Control": "pest", "Wildlife Removal": "pest",
    "Landscaping": "yard", "Lawn Care": "yard", "Irrigation & Sprinklers": "yard", "Tree Removal": "yard", "Tree Trimming": "yard", "Stump Grinding": "yard", "Pool Repair": "yard",
    "Carpet Cleaning": "cleaning", "House Cleaning": "cleaning", "Junk Removal": "cleaning", "Moving Services": "cleaning",
    "Garage Door Repair": "doors", "Garage Doors": "doors", "Locksmith": "doors",
    "Appliance Repair": "appliance",
  };

  function groupFor(service) {
    if (MAP[service]) return G[MAP[service]];
    const s = String(service || "").toLowerCase();
    const guess = /water|mold|flood|restor/.test(s) ? "water" : /plumb|drain|sewer|heater/.test(s) ? "plumbing" : /septic/.test(s) ? "septic"
      : /hvac|ac\b|air|heat|furnace|boiler|cool/.test(s) ? "hvac" : /electric|solar|generator|charger|light|security/.test(s) ? "electrical"
      : /roof|gutter|siding|window|paint|chimney/.test(s) ? "exterior" : /foundation|concrete|deck|fence|wall/.test(s) ? "structural"
      : /pest|termite|bug|wildlife|rodent/.test(s) ? "pest" : /lawn|tree|landscap|pool|yard/.test(s) ? "yard"
      : /clean|junk|mov/.test(s) ? "cleaning" : /garage|lock/.test(s) ? "doors" : /appliance/.test(s) ? "appliance" : "remodel";
    return G[guess];
  }

  // Returns [{label, text}] for one service. Placeholders are filled by fill().
  function pack(service) {
    const g = groupFor(service);
    const q = g.questions;
    const out = [
      { label: "First reply to “Is this available?”", text: `Hi! Yes, we can help with {service} in {city}. ${g.opener} The quickest way is to call {phone} and a local pro can talk it through with you.` },
      { label: "Qualifying questions", text: `Happy to help. A few quick questions so you get pointed the right way:\n1. ${q[0]}\n2. ${q[1]}\n3. ${q[2]}\nOr just call {phone} and they'll ask you on the phone.` },
      { label: "Reply to “How much?”", text: `Good question. It really depends on the job: ${g.factors.slice(0, -1).join(", ")} and ${g.factors[g.factors.length - 1]}. A local pro can give you an accurate quote once they know the details. Call {phone} and they can walk you through it.` },
      { label: "Reply to “Are you the company?”", text: `We're {brand}, a referral service. We connect homeowners in {city} with independent local {service} pros. When you call {phone}, you'll talk to a pro who can help with your job.` },
      { label: "Reply to “Can you just text me or send info?”", text: `I understand! The details really depend on your home, so the fastest way to get real answers is a short call at {phone}. If now isn't good, what time works better for you?` },
      { label: "Reply to “Do you cover my area?”", text: `We help homeowners in {city} and nearby areas. Call {phone} and they'll confirm whether your address is covered.` },
      { label: "Follow-up if they go quiet", text: `Hi again! Just checking in on your {service} question. If you still need help, you can reach a local pro at {phone}. No pressure at all.` },
      { label: "After they say they'll call", text: `Great! The number is {phone}. Mention what you told me here so they can help faster. Hope it gets sorted quickly!` },
    ];
    if (g.urgent) out.splice(1, 0, { label: "Reply to an urgent problem", text: `Sorry you're dealing with this. ${g.safety ? g.safety + " " : ""}For the fastest help, call {phone} now and a local pro can tell you what to do next.` });
    else if (g.safety) out.push({ label: "If they describe something dangerous", text: `${g.safety} Once everyone's safe, call {phone} and a local pro can help with the next steps.` });
    return { group: g.name, items: out };
  }

  const lowerKeepCaps = (s) => s.split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
  function fill(text, v) {
    if (!v.brand) text = text.replace("We're {brand}, a referral service.", "We're a referral service.");
    return text.replace(/\{service\}/g, lowerKeepCaps(v.service || "this service")).replace(/\{city\}/g, v.city || "your area")
      .replace(/\{phone\}/g, v.phone || "[your tracking number]").replace(/\{brand\}/g, v.brand || "a local referral service");
  }

  window.REPLY_PACKS = { pack, fill, services: Object.keys(MAP).sort(), groups: G };
})();
