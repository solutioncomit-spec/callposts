// Safe fetching of user-supplied public URLs (audits): blocks private/local addresses and follows redirects by hand.
export const MAX_BYTES = 2_500_000;
// Block private and local addresses so the audit can't be pointed at internal services.
export function privateIp(ip: string): boolean {
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  const n = ip.match(/^100\.(\d+)\./); if (n && +n[1] >= 64 && +n[1] <= 127) return true;
  return /^(::1|fc|fd|fe80)/i.test(ip);
}
export async function publicHost(host: string): Promise<boolean> {
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":")) return !privateIp(host);
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`);
    const j: any = await r.json();
    const ips: string[] = (j.Answer || []).filter((a: any) => a.type === 1).map((a: any) => String(a.data));
    return ips.length > 0 && !ips.some(privateIp);
  } catch { return false; }
}

export async function fetchSafe(start: string, timeoutMs = 12000): Promise<{ res: Response; finalUrl: string; ms: number } | { error: string }> {
  let url = start;
  const t0 = Date.now();
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return { error: "Only http and https addresses can be audited." };
    if (!(await publicHost(u.hostname))) return { error: "That address isn't a public website." };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; CallPostsAudit/1.0; +https://callposts.com)", accept: "text/html,*/*" } });
    } catch (e) {
      clearTimeout(timer);
      return { error: (e as Error)?.name === "AbortError" ? "The site took too long to respond." : "Couldn't reach that site. Check the address." };
    }
    clearTimeout(timer);
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, url).toString(); continue; }
    return { res, finalUrl: url, ms: Date.now() - t0 };
  }
  return { error: "Too many redirects." };
}

export async function readText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value); size += value.length;
    if (size > MAX_BYTES) { try { await reader.cancel(); } catch {} break; }
  }
  const all = new Uint8Array(size); let pos = 0;
  for (const c of chunks) { all.set(c.subarray(0, Math.min(c.length, size - pos)), pos); pos += c.length; if (pos >= size) break; }
  return new TextDecoder().decode(all);
}

