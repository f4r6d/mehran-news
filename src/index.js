import { ensureSchema, getMeta, getStats, listArticles, saveArticles } from "./db.js";
import { fetchAll } from "./feeds.js";
import { dayParts, fa, formatFull, localDayKey, parseDate, relative } from "./jalali.js";
import { CSS } from "./style.js";

const REFRESH_MIN_INTERVAL_MS = 2 * 60 * 1000;

const EMPTY_STATE = `
<section class="empty">
  <h2>هنوز خبری ذخیره نشده است</h2>
  <p>واکشی اولیه ممکن است چند ثانیه طول بکشد. دکمه را بزنید یا چند لحظه بعد صفحه را تازه کنید.</p>
  <form method="post" action="/refresh"><button class="primary" type="submit">واکشی خبرها</button></form>
</section>`;

let refreshInFlight = null;

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
}

function flashFor(url) {
  const params = url.searchParams;
  if (params.has("refreshed")) {
    const result = params.get("refreshed");
    if (result === "1") return "به‌روزرسانی انجام شد.";
    if (result === "rate") return "به‌تازگی به‌روزرسانی شده است؛ چند دقیقه بعد دوباره تلاش کنید.";
    if (result === "error") return "واکشی ناموفق بود؛ اتصال اینترنت را بررسی کنید.";
    return "خبر تازه‌تری پیدا نشد.";
  }
  if (params.has("busy")) return "یک به‌روزرسانی در حال اجراست؛ چند لحظه بعد دوباره تلاش کنید.";
  return "";
}

async function refreshNews(env) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    await ensureSchema(env.DB);
    const last = await getMeta(env.DB, "last_fetch");
    if (last && Date.now() - new Date(last).getTime() < REFRESH_MIN_INTERVAL_MS) {
      return { fetched: 0, inserted: 0, skipped: true };
    }

    const { articles, feedsOk } = await fetchAll(env);
    if (feedsOk === 0) throw new Error("all news feeds failed");

    const fetchedAt = new Date().toISOString();
    const inserted = await saveArticles(env.DB, articles, fetchedAt);
    return { fetched: articles.length, inserted, skipped: false };
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function card(row, published, now) {
  const url = escapeHtml(row.url);
  const title = escapeHtml(row.title);
  const source = escapeHtml(row.source || "منبع نامشخص");
  const summary = escapeHtml(row.summary || "");
  const image = row.image_url || "";

  const thumb =
    image.startsWith("https://")
      ? `<a class="thumb" href="${url}" target="_blank" rel="noopener noreferrer" tabindex="-1">` +
        `<img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></a>`
      : "";

  const summaryHtml = summary ? `<p class="summary">${summary}</p>` : "";
  const fullTime = escapeHtml(formatFull(published));

  return (
    `<article class="card">${thumb}<div class="body">` +
    `<h3><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>` +
    summaryHtml +
    `<div class="meta"><span class="source">${source}</span><span class="dot">·</span>` +
    `<time datetime="${escapeHtml(row.published_at || "")}" title="${fullTime}">${relative(published, now)}</time>` +
    `</div></div></article>`
  );
}

function groupRows(rows, now) {
  const groups = [];
  for (const row of rows) {
    const published = parseDate(row.published_at);
    const key = localDayKey(published);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const [title, subtitle] = dayParts(published, now);
      group = { key, title, subtitle, items: [] };
      groups.push(group);
    }
    group.items.push({ row, published });
  }
  return groups;
}

async function renderPage(env, flash) {
  const [rows, stats] = await Promise.all([listArticles(env.DB, 300), getStats(env.DB)]);
  const now = new Date();
  const last = stats.lastFetch ? parseDate(stats.lastFetch) : null;
  const updated = last ? relative(last, now) : "—";

  const sections = groupRows(rows, now).map((group) => {
    const cards = group.items.map(({ row, published }) => card(row, published, now)).join("");
    return (
      `<section class="day"><div class="day-head">` +
      `<h2>${escapeHtml(group.title)}</h2><span>${escapeHtml(group.subtitle)}</span>` +
      `</div>${cards}</section>`
    );
  });

  const main = sections.join("") || EMPTY_STATE;
  const flashHtml = flash ? `<span class="flash">${escapeHtml(flash)}</span>` : "";

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>مهران‌نیوز | اخبار مهران مدیری</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%23e8590c'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="topline">
      <div class="brand"><span class="mark" aria-hidden="true"></span><h1>مهران‌نیوز</h1></div>
      <form class="refresh" method="post" action="/refresh">
        <button type="submit">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          به‌روزرسانی
        </button>
      </form>
    </div>
    <p class="tagline">همه‌ی اخبار مهران مدیری، هر روز و یک‌جا — از رسانه‌های فارسی و انگلیسی.</p>
    <div class="status">
      <span>${fa(stats.count)} خبر</span>
      <span class="sep">·</span>
      <span>${fa(stats.sources)} منبع</span>
      <span class="sep">·</span>
      <span>آخرین به‌روزرسانی ${updated}</span>
      ${flashHtml}
    </div>
  </header>
  <main>${main}</main>
  <footer>
    <p>منابع: بینگ‌نیوز و گوگل‌نیوز · به‌روزرسانی خودکار هر ۶ ساعت · داده‌ها در Cloudflare D1</p>
  </footer>
</div>
</body>
</html>`;
}

async function handleRefresh(request, env, url) {
  let result = "0";
  try {
    const outcome = await refreshNews(env);
    if (outcome.skipped) result = "rate";
    else if (outcome.inserted > 0) result = "1";
  } catch (error) {
    console.error("refresh failed:", error);
    result = "error";
  }
  return Response.redirect(new URL(`/?refreshed=${result}`, url).toString(), 303);
}

export default {
  async fetch(request, env) {
    await ensureSchema(env.DB);
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/" && request.method === "GET") {
      const html = await renderPage(env, flashFor(url));
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    }

    if (pathname === "/refresh") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleRefresh(request, env, url);
    }

    if (pathname === "/api/news" && request.method === "GET") {
      const [articles, stats] = await Promise.all([
        listArticles(env.DB, 300),
        getStats(env.DB),
      ]);
      return new Response(
        JSON.stringify({
          count: stats.count,
          sources: stats.sources,
          last_fetch: stats.lastFetch,
          articles,
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (pathname === "/static/style.css") {
      return new Response(CSS, {
        headers: {
          "Content-Type": "text/css; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      refreshNews(env).catch((error) => console.error("scheduled refresh failed:", error))
    );
  },
};
