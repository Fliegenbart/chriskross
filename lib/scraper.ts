import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (compatible; KrossmailBot/0.1; +https://chrisskross.de/)";

async function fetchText(url: string, timeoutMs = 10_000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("xml")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractReadableText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, iframe, svg").remove();
  const title = $("title").text().trim();
  const desc =
    $('meta[name="description"]').attr("content") ??
    $('meta[property="og:description"]').attr("content") ??
    "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(" | ");
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().slice(0, 10).join(" | ");
  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  return [
    `TITLE: ${title}`,
    `DESCRIPTION: ${desc}`,
    `H1: ${h1}`,
    `H2: ${h2}`,
    `TEXT: ${bodyText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function candidateSubpages($: cheerio.CheerioAPI, baseUrl: URL): string[] {
  const hints = ["uber-uns", "ueber-uns", "about", "team", "leistungen", "services", "aktuelles", "news", "blog"];
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const u = new URL(href, baseUrl);
      if (u.hostname !== baseUrl.hostname) return;
      const path = u.pathname.toLowerCase();
      if (hints.some((h) => path.includes(h))) {
        urls.add(u.toString());
      }
    } catch {
      /* ignore */
    }
  });
  return [...urls].slice(0, 2);
}

function normalizeUrl(raw: string): string | null {
  try {
    let v = raw.trim();
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    const u = new URL(v);
    return u.toString();
  } catch {
    return null;
  }
}

export async function scrapeCompany(url: string): Promise<string | null> {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const base = new URL(normalized);

  const homeHtml = await fetchText(normalized);
  if (!homeHtml) return null;
  const $home = cheerio.load(homeHtml);
  let combined = `=== ${normalized} ===\n${extractReadableText($home)}`;

  const subs = candidateSubpages($home, base);
  for (const sub of subs) {
    const html = await fetchText(sub);
    if (!html) continue;
    const $ = cheerio.load(html);
    combined += `\n\n=== ${sub} ===\n${extractReadableText($)}`;
  }
  return combined.slice(0, 12_000);
}

export function guessWebsiteFromEmail(email: string): string | null {
  const m = email.match(/@([^\s]+)$/);
  if (!m) return null;
  const domain = m[1].toLowerCase();
  const skip = ["gmail.com", "googlemail.com", "gmx.de", "gmx.net", "web.de", "t-online.de", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.de", "icloud.com", "me.com", "aol.com", "mail.de"];
  if (skip.includes(domain)) return null;
  return `https://${domain}/`;
}
