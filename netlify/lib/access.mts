import { getUser } from "@netlify/identity";
import { changeCredits } from "./credits.mts";

// Who is calling an AI endpoint, and paying for it.
// Access codes (ACCESS_CODES env var) are unlimited beta/partner passes.
// Everyone else must be logged in and is charged credits up front; refund() gives them back on failure.

export type Payer =
  | { ok: true; kind: "code"; label: string; credits: null; refund: () => Promise<void> }
  | { ok: true; kind: "user"; label: string; credits: number; refund: () => Promise<void> }
  | { ok: false; res: Response };

function codeFrom(req: Request): string | null {
  const codes = (Netlify.env.get("ACCESS_CODES") || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const code = (req.headers.get("x-access-code") || "").trim().toUpperCase();
  return code && codes.includes(code) ? code : null;
}

export async function payFor(req: Request, cost: number, why: string): Promise<Payer> {
  const code = codeFrom(req);
  if (code) return { ok: true, kind: "code", label: code, credits: null, refund: async () => {} };
  if ((req.headers.get("x-access-code") || "").trim()) {
    return { ok: false, res: Response.json({ error: "That access code isn't valid. Check it, or log in to use your credits." }, { status: 401 }) };
  }

  const user = await getUser();
  if (!user) return { ok: false, res: Response.json({ error: "Log in or create an account to use the AI tools.", needLogin: true }, { status: 401 }) };
  const email = user.email || "";
  let acc;
  try {
    acc = await changeCredits(user.id, email, -cost, why);
  } catch (e) {
    console.error("credit charge failed", e);
    return { ok: false, res: Response.json({ error: "Couldn't check your credits. Try again in a moment." }, { status: 503 }) };
  }
  if (!acc) {
    return { ok: false, res: Response.json({ error: `This needs ${cost} credit${cost === 1 ? "" : "s"} and your balance is too low. Buy more credits to keep going.`, needCredits: true }, { status: 402 }) };
  }
  let refunded = false;
  return {
    ok: true, kind: "user", label: email || user.id, credits: acc.credits,
    refund: async () => {
      if (refunded) return;
      refunded = true;
      try { await changeCredits(user.id, email, cost, `refund: ${why}`); } catch (e) { console.error("refund failed", e); }
    },
  };
}

export function creditHeaders(p: Payer): Record<string, string> {
  return p.ok && p.kind === "user" ? { "x-credits": String(p.credits) } : {};
}

export function clean(v: unknown, max = 300): string {
  return String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

export function isAdminEmail(email?: string): boolean {
  const admins = (Netlify.env.get("ADMIN_EMAILS") || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}
