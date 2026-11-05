const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 MehranNews/1.0";

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const ITEM_RE = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function bing(query, sortByDate = false) {
  const params = new URLSearchParams({ q: query, format: "RSS" });
  if (sortByDate) params.set("qft", 'sortbydate="1"');
  return `https://www.bing.com/news/search?${params}`;
}

function google(query, hl, gl, ceid) {
  const params = new URLSearchParams({ q: query, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params}`;
}

const FEEDS = [
  bing('"مهران مدیری"'),
  bing("مهران مدیری"),
  bing("مهران مدیری", true),
  bing('"Mehran Modiri"'),
  google('"Mehran Modiri"', "en-US", "US", "US:en"),
];

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function clean(value) {
  if (!value) return "";
  const text = value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

function findTag(block, tag, allowPrefix = false) {
  const prefix = allowPrefix ? "(?:[\\w.-]+:)?" : "";
  const re = new RegExp(
    `<${prefix}${tag}\\b[^>]*>([\\s\\S]*?)<\\/${prefix}${tag}>`,
    "i"
  );
  const match = block.match(re);
  return match ? match[1] : "";
}

function shorten(text, limit = 320) {
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "").replace(/[،,;]$/, "") + "…";
}

function relevant(title, summary) {
  const text = `${title} ${summary}`;
  return /modiri/i.test(text) || (text.includes("مهران") && /مدیری(?!ت)/.test(text));
}

function canonical(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return "";
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || TRACKING_PARAMS.has(lower)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function originalLink(raw) {
  let link = (raw || "").trim();
  try {
    const parsed = new URL(link);
    if (parsed.hostname.endsWith("bing.com")) {
      const target = parsed.searchParams.get("url");
      if (target && /^https?:\/\//i.test(target)) link = target;
    }
  } catch {
    return "";
  }
  return canonical(link);
}

function imageUrl(raw) {
  let value = (raw || "").trim();
  if (value.startsWith("//")) value = `https:${value}`;
  if (value.startsWith("http://")) value = `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : "";
}

function publishedAt(raw) {
  if (!raw) return new Date();
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function parseFeed(xml, maxAgeDays) {
  const items = [];
  for (const match of xml.matchAll(ITEM_RE)) {
    const block = match[1];
    let title = clean(findTag(block, "title"));
    const summary = clean(findTag(block, "description"));
    const link = originalLink(clean(findTag(block, "link")));
    if (!title || !link) continue;

    let source = clean(findTag(block, "source", true));
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }
    if (!relevant(title, summary)) continue;

    const published = publishedAt(findTag(block, "pubDate"));
    if (Date.now() - published.getTime() > maxAgeDays * 86400000) continue;

    if (!source) {
      try {
        source = new URL(link).hostname.replace(/^www\./, "");
      } catch {
        source = "";
      }
    }

    items.push({
      title,
      url: link,
      source,
      summary: shorten(summary),
      image_url: imageUrl(clean(findTag(block, "image", true))),
      published_at: published.toISOString(),
    });
  }
  return items;
}

async function download(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function fetchAll(env) {
  const maxAgeDays = Number(env?.MAX_AGE_DAYS || 45);
  const results = await Promise.allSettled(FEEDS.map((url) => download(url)));
  const seen = new Set();
  const articles = [];
  let feedsOk = 0;

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status !== "fulfilled") {
      console.warn(
        "feed failed:",
        FEEDS[index],
        result.reason?.message || result.reason
      );
      continue;
    }
    feedsOk += 1;
    for (const article of parseFeed(result.value, maxAgeDays)) {
      if (seen.has(article.url)) continue;
      seen.add(article.url);
      articles.push(article);
    }
  }

  return { articles, feedsOk };
}
