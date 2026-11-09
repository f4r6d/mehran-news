import { dayParts, fa, formatFull, localDayKey, parseDate, relative } from "./jalali.js";
import { CSS_VERSION } from "./style.js";

const FLASH = {
  user_approved: "کاربر تأیید شد.",
  user_blocked: "کاربر بلاک شد.",
  user_unblocked: "بلاک کاربر برداشته شد.",
  user_promoted: "کاربر به ادمین ارتقا یافت.",
  notify_on: "اجازه دریافت اعلان فعال شد.",
  notify_off: "اجازه دریافت اعلان غیرفعال شد.",
  comment_approved: "نظر تأیید شد.",
  comment_rejected: "نظر رد شد.",
  comment_deleted: "نظر حذف شد.",
  comment_replied: "پاسخ ثبت و نظر تأیید شد.",
  article_deleted: "خبر حذف شد.",
  article_archived: "خبر به آرشیو منتقل شد.",
  article_restored: "خبر از آرشیو بازگردانده شد.",
  admin_created: "ادمین جدید ساخته شد.",
  login_required: "برای این کار ابتدا وارد شوید.",
  profile_saved: "ذخیره شد.",
  message_sent: "پیام شما برای مدیریت ارسال شد.",
  notify_saved: "وضعیت اعلان ذخیره شد.",
  telegram_unlinked: "اتصال تلگرام قطع شد.",
  pending: "حساب شما در انتظار تأیید ادمین است.",
  blocked: "حساب شما بلاک شده است.",
  bad_login: "نام کاربری یا رمز عبور درست نیست.",
  rate: "تلاش‌های ناموفق زیاد بود؛ چند دقیقه بعد دوباره تلاش کنید.",
  duplicate: "این نام کاربری قبلاً گرفته شده است.",
  weak: "رمز عبور باید حداقل ۶ نویسه باشد.",
  invalid_username:
    "نام کاربری باید ۳ تا ۳۰ نویسه و شامل حروف، رقم، نقطه، خط تیره یا زیرخط باشد.",
  registered: "ثبت‌نام انجام شد؛ پس از تأیید ادمین می‌توانید وارد شوید.",
  profanity: "متن نظر شامل کلمات نامناسب است؛ لطفاً آن را اصلاح کنید.",
  message_profanity: "متن پیام شامل کلمات نامناسب است؛ لطفاً آن را اصلاح کنید.",
  comment_pending: "نظر شما ثبت شد و پس از تأیید ادمین نمایش داده می‌شود.",
  comment_posted: "نظر شما ثبت شد.",
  forum_thread_created: "رشته ساخته شد.",
  forum_post_created: "پیام شما ثبت شد.",
  forum_post_edited: "پیام ویرایش شد.",
  forum_post_deleted: "پیام حذف شد.",
  forum_thread_deleted: "رشته حذف شد.",
  forum_updated: "تنظیمات رشته ذخیره شد.",
  forum_locked: "این رشته قفل شده است.",
  forum_title_short: "عنوان رشته باید بین ۴ تا ۱۲۰ نویسه باشد.",
  forum_body_short: "متن پیام باید حداقل ۵ نویسه باشد.",
  forum_body_long: "متن پیام نباید بیشتر از ۴۰۰۰ نویسه باشد.",
  forum_profanity: "متن شامل کلمات نامناسب است؛ لطفاً آن را اصلاح کنید.",
  forum_board_invalid: "تابلوی انتخاب‌شده معتبر نیست.",
};

export function flashFor(url) {
  const code = url.searchParams.get("msg");
  return code ? FLASH[code] || "" : "";
}

export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
  );
}

function nav(user) {
  const links = [`<a href="/">خانه</a>`, `<a href="/forum">فروم</a>`];
  if (user) {
    links.push(`<a href="/panel">پنل من</a>`);
    if (user.role === "admin") links.push(`<a href="/admin">مدیریت</a>`);
    links.push(
      `<form method="post" action="/logout" class="inline"><button type="submit" class="link-button">خروج</button></form>`
    );
  } else {
    links.push(`<a href="/login">ورود</a>`);
    links.push(`<a href="/register">ثبت‌نام</a>`);
  }
  return `<nav class="nav">${links.join("")}</nav>`;
}

function masthead(user) {
  return `<div class="topline">
    <div class="brand"><span class="mark" aria-hidden="true"></span><h1><a href="/">مدیری‌نیوز</a></h1></div>
    ${nav(user)}
  </div>`;
}

export function layout({ title, user, body, flash, header }) {
  const flashHtml = flash ? `<p class="flash">${esc(flash)}</p>` : "";
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='42' fill='%23e8590c'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/static/style.css?v=${CSS_VERSION}">
</head>
<body>
<div class="wrap">
  <header class="masthead">
    ${masthead(user)}
    ${header || ""}
  </header>
  ${flashHtml}
  <main>${body}</main>
</div>
<script>
document.addEventListener("submit", async (event) => {
  const form = event.target.closest(".like-form");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button");
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (response.status === 401) {
      window.location.href = "/login?next=" + encodeURIComponent(location.pathname);
      return;
    }
    if (!response.ok) throw new Error("failed");
    const data = await response.json();
    button.classList.toggle("liked", data.liked);
    button.setAttribute("aria-pressed", data.liked ? "true" : "false");
    button.setAttribute("aria-label", data.liked ? "برداشتن لایک" : "لایک");
    const label = button.querySelector(".like-label");
    if (label) {
      label.textContent = data.liked
        ? button.dataset.labelOn || "لایک شده"
        : button.dataset.labelOff || "لایک";
    }
    const count = button.querySelector(".like-count");
    if (count) {
      count.textContent = String(data.count).replace(/\\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
    }
  } catch {
    form.submit();
  } finally {
    button.disabled = false;
  }
});
</script>
</body>
</html>`;
}

function likeForm(article) {
  const liked = Boolean(article.liked);
  return `<form method="post" action="/news/${article.id}/like" class="like-form">
    <button type="submit" class="like action-pill ${liked ? "liked" : ""}" aria-label="${
      liked ? "برداشتن لایک" : "لایک"
    }" aria-pressed="${liked ? "true" : "false"}">
      <span aria-hidden="true" class="like-heart">♥</span>
      <span class="like-label">${liked ? "لایک شده" : "لایک"}</span>
      <span class="like-count">${fa(article.like_count || 0)}</span>
    </button>
  </form>`;
}

function card(row, published, now) {
  const url = esc(row.url);
  const title = esc(row.title);
  const source = esc(row.source || "منبع نامشخص");
  const summary = esc(row.summary || "");
  const image = row.image_url || "";
  const articleUrl = `/news/${row.id}`;

  const thumb = image.startsWith("https://")
    ? `<a class="thumb" href="${articleUrl}" tabindex="-1">` +
      `<img src="${esc(image)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></a>`
    : "";

  return (
    `<article class="card">${thumb}<div class="body">` +
    `<h3><a href="${articleUrl}">${title}</a></h3>` +
    (summary ? `<p class="summary">${summary}</p>` : "") +
    `<div class="meta"><span class="source">${source}</span><span class="dot">·</span>` +
    `<time datetime="${esc(row.published_at || "")}" title="${esc(formatFull(published))}">${relative(published, now)}</time>` +
    `</div>` +
    `<div class="card-actions">` +
    `<a class="action-pill comments-link" href="${articleUrl}#comments">` +
    `<span class="comments-label">نظرها</span><span class="comments-count">${fa(row.comment_count || 0)}</span></a>` +
    likeForm(row) +
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

function emptyState(canRefresh) {
  return `
<section class="empty">
  <h2>هنوز خبری ذخیره نشده است</h2>
  <p>چند لحظه بعد صفحه را تازه کنید.</p>
  ${
    canRefresh
      ? `<form method="post" action="/refresh"><button class="primary" type="submit">واکشی خبرها</button></form>`
      : ""
  }
</section>`;
}

const SORT_TABS = [
  ["newest", "جدیدترین"],
  ["popular", "محبوب‌ترین"],
  ["comments", "پرنظرترین"],
];

const SORT_HEADINGS = {
  popular: "محبوب‌ترین خبرها",
  comments: "پرنظرترین خبرها",
};

function homeHref(sort, page) {
  const params = new URLSearchParams();
  if (sort !== "newest") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function pager(sort, page, totalPages) {
  if (totalPages <= 1) return "";
  const previous =
    page > 1
      ? `<a class="pager-link" href="${homeHref(sort, page - 1)}">قبلی</a>`
      : `<span class="pager-link disabled">قبلی</span>`;
  const next =
    page < totalPages
      ? `<a class="pager-link" href="${homeHref(sort, page + 1)}">بعدی</a>`
      : `<span class="pager-link disabled">بعدی</span>`;
  return `<nav class="pager" aria-label="صفحه‌بندی">${previous}<span class="pager-status">صفحه ${fa(
    page
  )} از ${fa(totalPages)}</span>${next}</nav>`;
}

export function homePage({ user, rows, stats, flash, now, sort = "newest", page = 1, totalPages = 1 }) {
  const last = stats.lastFetch ? parseDate(stats.lastFetch) : null;
  const updated = last ? relative(last, now) : "—";

  let content = "";
  if (rows.length) {
    if (sort === "newest") {
      content = groupRows(rows, now)
        .map((group) => {
          const cards = group.items.map(({ row, published }) => card(row, published, now)).join("");
          return (
            `<section class="day"><div class="day-head">` +
            `<h2>${esc(group.title)}</h2><span>${esc(group.subtitle)}</span>` +
            `</div>${cards}</section>`
          );
        })
        .join("");
    } else {
      content =
        `<section class="day"><div class="day-head">` +
        `<h2>${SORT_HEADINGS[sort] || "خبرها"}</h2><span>${fa(rows.length)} خبر در این صفحه</span>` +
        `</div>${rows.map((row) => card(row, parseDate(row.published_at), now)).join("")}</section>`;
    }
  } else {
    content = emptyState(user?.role === "admin");
  }

  const canRefresh = user?.role === "admin";
  const refreshForm = canRefresh
    ? `<form class="refresh inline" method="post" action="/refresh"><button type="submit">به‌روزرسانی</button></form>`
    : "";

  const sortNav = `<nav class="tabs sort-tabs" aria-label="مرتب‌سازی">${SORT_TABS.map(
    ([key, label]) =>
      `<a href="${homeHref(key, 1)}" class="${sort === key ? "active" : ""}"${
        sort === key ? ` aria-current="page"` : ""
      }>${label}</a>`
  ).join("")}</nav>`;

  const header = `
    <div class="status">
      <span>${fa(stats.count)} خبر</span>
      <span class="sep">·</span>
      <span>${fa(stats.sources)} منبع</span>
      <span class="sep">·</span>
      <span>آخرین به‌روزرسانی ${updated}</span>
      ${refreshForm}
    </div>
    ${sortNav}`;

  return layout({
    title: "مدیری‌نیوز | اخبار مهران مدیری",
    user,
    flash,
    header,
    body: content + pager(sort, page, totalPages),
  });
}

export function articlePage({ user, article, comments, flash, now }) {
  const published = parseDate(article.published_at);
  const commentItems = comments
    .map((comment) => {
      const reply = comment.admin_reply
        ? `<div class="reply"><strong>پاسخ ادمین:</strong> ${esc(comment.admin_reply)}</div>`
        : "";
      const remove =
        user?.role === "admin"
          ? `<div class="comment-actions"><form method="post" action="/admin/comments/${comment.id}/delete" class="inline" onsubmit="return confirm('این نظر حذف شود؟')"><button type="submit" class="danger-link">حذف نظر</button></form></div>`
          : "";
      return `<div class="comment"><div class="comment-head">${esc(comment.username)} · ${relative(
        parseDate(comment.created_at),
        now
      )}</div><p>${esc(comment.body)}</p>${reply}${remove}</div>`;
    })
    .join("");

  const commentForm = user
    ? `<form method="post" action="/news/${article.id}/comment" class="form">
        <label for="body">نظر شما</label>
        <textarea id="body" name="body" rows="4" maxlength="1200" required></textarea>
        <p class="hint">نظر پس از تأیید ادمین نمایش داده می‌شود. توهین و فحش خودکار رد می‌شود.</p>
        <button class="primary" type="submit">ارسال نظر</button>
      </form>`
    : `<p class="hint">برای ثبت نظر <a class="text-link" href="/login?next=/news/${article.id}">وارد شوید</a>.</p>`;

  const header = `<p class="tagline"><a class="text-link" href="/">بازگشت به فهرست اخبار</a></p>`;

  const body = `
    <article class="article">
      <h2>${esc(article.title)}</h2>
      <div class="meta"><span class="source">${esc(article.source || "")}</span>
        <span class="dot">·</span>
        <time>${esc(formatFull(published))}</time>
        ${likeForm(article)}
      </div>
      <p class="article-summary">${esc(article.summary || "")}</p>
      <p><a class="button-link" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">خواندن خبر اصلی</a></p>
    </article>
    <section class="comments" id="comments">
      <h2>نظرها (${fa(comments.length)})</h2>
      ${commentItems || `<p class="hint">هنوز نظری تأیید نشده است.</p>`}
      ${commentForm}
    </section>`;

  return layout({ title: `${article.title} | مدیری‌نیوز`, user, flash, header, body });
}

export function loginPage({ user, flash, next }) {
  const body = `
    <section class="panel narrow">
      <h2>ورود</h2>
      <form method="post" action="/login" class="form">
        <input type="hidden" name="next" value="${esc(next || "")}">
        <label for="username">نام کاربری</label>
        <input id="username" name="username" autocomplete="username" required>
        <label for="password">رمز عبور</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button class="primary" type="submit">ورود</button>
      </form>
      <p class="hint">حساب ندارید؟ <a class="text-link" href="/register">ثبت‌نام کنید</a>.</p>
    </section>`;
  return layout({ title: "ورود | مدیری‌نیوز", user, flash, body });
}

export function registerPage({ user, flash }) {
  const body = `
    <section class="panel narrow">
      <h2>ثبت‌نام</h2>
      <form method="post" action="/register" class="form">
        <label for="username">نام کاربری</label>
        <input id="username" name="username" autocomplete="username" required minlength="3" maxlength="30">
        <label for="password">رمز عبور</label>
        <input id="password" name="password" type="password" autocomplete="new-password" required minlength="6">
        <button class="primary" type="submit">ثبت‌نام</button>
      </form>
      <p class="hint">حساب دارید؟ <a class="text-link" href="/login">وارد شوید</a>.</p>
    </section>`;
  return layout({ title: "ثبت‌نام | مدیری‌نیوز", user, flash, body });
}

function statusLabel(user) {
  if (user.status === "active") return "فعال";
  if (user.status === "blocked") return "بلاک";
  return "در انتظار تأیید";
}

export function panelPage({ user, flash, linkToken, botUsername }) {
  const bot = botUsername ? `https://t.me/${esc(botUsername)}` : null;
  const linkUrl = bot && linkToken ? `${bot}?start=${encodeURIComponent(linkToken)}` : null;

  const telegramBlock = user.telegram_chat_id
    ? `<p>وضعیت: متصل${user.telegram_username ? ` (${esc(user.telegram_username)})` : ""}</p>
       ${
         user.notify_allowed
           ? `<form method="post" action="/panel/notify">
                <input type="hidden" name="enabled" value="${user.notify_enabled ? "0" : "1"}">
                <button type="submit" class="${user.notify_enabled ? "" : "primary"}">${
                  user.notify_enabled ? "خاموش کردن اعلان‌ها" : "روشن کردن اعلان‌ها"
                }</button>
              </form>`
           : `<p class="hint">اجازه دریافت اعلان توسط ادمین غیرفعال شده است.</p>`
       }
       <form method="post" action="/panel/telegram/unlink" class="inline">
         <button type="submit" class="danger-link">قطع اتصال تلگرام</button>
       </form>`
    : `<p>هنوز به تلگرام متصل نیستید.</p>
       ${
         bot
           ? `<form method="post" action="/panel/telegram/link">
                <button class="primary" type="submit">ساخت لینک اتصال</button>
              </form>`
           : `<p class="hint">ربات تلگرام هنوز توسط مدیر سامانه پیکربندی نشده است.</p>`
       }`;

  const tokenBlock = linkUrl
    ? `<div class="notice"><p>لینک اتصال (۱۵ دقیقه اعتبار):</p>
         <p><a class="button-link" href="${esc(linkUrl)}" target="_blank" rel="noopener noreferrer">باز کردن تلگرام و اتصال</a></p>
         <p dir="ltr" class="mono">${esc(linkUrl)}</p></div>`
    : "";

  const body = `
    <section class="panel">
      <h2>پنل من</h2>
      <div class="kv"><span>نام کاربری</span><strong>${esc(user.username)}</strong></div>
      <div class="kv"><span>نقش</span><strong>${user.role === "admin" ? "ادمین" : "کاربر"}</strong></div>
      <div class="kv"><span>وضعیت</span><strong>${statusLabel(user)}</strong></div>
      <div class="kv"><span>تاریخ عضویت</span><strong>${esc(formatFull(parseDate(user.created_at)))}</strong></div>
    </section>
    <section class="panel">
      <h2>اعلان‌های تلگرام</h2>
      ${telegramBlock}
      ${tokenBlock}
    </section>
    <section class="panel">
      <h2>پیام به مدیریت</h2>
      <form method="post" action="/panel/message" class="form">
        <label for="message">متن پیام</label>
        <textarea id="message" name="body" rows="4" maxlength="2000" required></textarea>
        <button class="primary" type="submit">ارسال پیام</button>
      </form>
    </section>`;
  return layout({ title: "پنل من | مدیری‌نیوز", user, flash, body });
}

function adminTabs(active) {
  const tabs = [
    ["overview", "/admin", "نمای کلی"],
    ["news", "/admin/news", "اخبار"],
    ["archive", "/admin/archive", "آرشیو"],
    ["users", "/admin/users", "کاربران"],
    ["comments", "/admin/comments", "نظرها"],
    ["messages", "/admin/messages", "پیام‌ها"],
  ];
  return `<nav class="tabs">${tabs
    .map(
      ([key, href, label]) =>
        `<a href="${href}" class="${active === key ? "active" : ""}">${esc(label)}</a>`
    )
    .join("")}</nav>`;
}

export function adminOverviewPage({ user, flash, stats, visits = [] }) {
  const maxViews = Math.max(1, ...visits.map((item) => item.views));
  const visitRows = visits
    .slice()
    .reverse()
    .map((item) => {
      const width = item.views
        ? Math.min(100, Math.max(10, Math.round((item.views / maxViews) * 10) * 10))
        : 0;
      return `<div class="visit-row">
        <span class="visit-day">${esc(item.label)}</span>
        <span class="visit-bar"><span class="visit-fill v-${width}"></span></span>
        <strong class="visit-count">${fa(item.views)}</strong>
      </div>`;
    })
    .join("");

  const body = `
    <section class="panel">
      <h2>پنل مدیریت</h2>
      ${adminTabs("overview")}
      <div class="stats-grid">
        <a class="stat" href="#daily-visits"><strong>${fa(stats.todayVisits)}</strong><span>بازدید امروز</span></a>
        <a class="stat" href="/admin/news"><strong>${fa(stats.count)}</strong><span>خبر فعال</span></a>
        <a class="stat" href="/admin/archive"><strong>${fa(stats.archived)}</strong><span>خبر آرشیو</span></a>
        <a class="stat" href="/admin/comments?status=pending"><strong>${fa(stats.pendingComments)}</strong><span>نظر در انتظار</span></a>
        <a class="stat" href="/admin/users"><strong>${fa(stats.pendingUsers)}</strong><span>کاربر در انتظار</span></a>
        <a class="stat" href="/admin/messages"><strong>${fa(stats.unreadMessages)}</strong><span>پیام تازه</span></a>
        <a class="stat" href="/admin/users"><strong>${fa(stats.users)}</strong><span>کل کاربران</span></a>
      </div>
    </section>
    <section class="panel" id="daily-visits">
      <h2>بازدیدهای روزانه</h2>
      <p class="hint">بازدید صفحات عمومی در ۷ روز اخیر، به وقت تهران.</p>
      <div class="visit-chart">${visitRows}</div>
    </section>`;
  return layout({ title: "پنل مدیریت | مدیری‌نیوز", user, flash, body });
}

function newsRow(article, archived) {
  const action = archived
    ? `<form method="post" action="/admin/archive/${article.id}/restore" class="inline"><button type="submit">بازگردانی</button></form>`
    : `<form method="post" action="/admin/news/${article.id}/archive" class="inline"><button type="submit">آرشیو</button></form>`;
  return `<div class="row">
    <div class="row-main">
      <a class="text-link" href="/news/${article.id}">${esc(article.title)}</a>
      <span class="hint">${esc(article.source || "")} · ${esc(
        formatFull(parseDate(article.published_at || article.fetched_at))
      )}${archived ? " · آرشیو" : ""}</span>
    </div>
    <div class="row-actions">${action}
      <form method="post" action="/admin/news/${article.id}/delete" class="inline" onsubmit="return confirm('این خبر و نظرهایش حذف شود؟')"><button type="submit" class="danger">حذف</button></form>
    </div>
  </div>`;
}

export function adminNewsPage({ user, flash, articles, archived }) {
  const rows = articles.map((article) => newsRow(article, archived)).join("");
  const body = `
    <section class="panel">
      <h2>${archived ? "آرشیو اخبار" : "مدیریت اخبار"}</h2>
      ${adminTabs(archived ? "archive" : "news")}
      ${rows || `<p class="hint">${archived ? "آرشیو خالی است." : "خبری ثبت نشده است."}</p>`}
    </section>`;
  return layout({ title: "مدیریت اخبار | مدیری‌نیوز", user, flash, body });
}

function userRow(entry, currentUser) {
  const badge = `<span class="badge ${entry.status}">${statusLabel(entry)}</span>`;
  const actions = [];
  if (entry.status === "pending") {
    actions.push(`<form method="post" action="/admin/users/${entry.id}/approve" class="inline"><button type="submit">تأیید</button></form>`);
  }
  if (entry.status === "active" && entry.id !== currentUser.id) {
    actions.push(`<form method="post" action="/admin/users/${entry.id}/block" class="inline"><button type="submit" class="danger">بلاک</button></form>`);
  }
  if (entry.status === "blocked") {
    actions.push(`<form method="post" action="/admin/users/${entry.id}/unblock" class="inline"><button type="submit">رفع بلاک</button></form>`);
  }
  if (entry.role === "user" && entry.status === "active") {
    actions.push(`<form method="post" action="/admin/users/${entry.id}/promote" class="inline"><button type="submit">ارتقا به ادمین</button></form>`);
  }
  actions.push(
    `<form method="post" action="/admin/users/${entry.id}/${entry.notify_allowed ? "notify-off" : "notify-on"}" class="inline"><button type="submit">${
      entry.notify_allowed ? "قطع اجازه اعلان" : "اجازه اعلان"
    }</button></form>`
  );

  return `<div class="row">
    <div class="row-main">
      <strong>${esc(entry.username)}</strong> ${badge}
      <span class="hint">${entry.role === "admin" ? "ادمین" : "کاربر"} · تلگرام: ${
        entry.telegram_chat_id ? "متصل" : "—"
      } · اجازه اعلان: ${entry.notify_allowed ? "دارد" : "ندارد"} · ${esc(
        formatFull(parseDate(entry.created_at))
      )}</span>
    </div>
    <div class="row-actions">${actions.join("")}</div>
  </div>`;
}

export function adminUsersPage({ user, flash, entries }) {
  const createForm = `<form method="post" action="/admin/users/create-admin" class="form inline-form">
    <input name="username" placeholder="نام کاربری ادمین جدید" required minlength="3" maxlength="30">
    <input name="password" type="password" placeholder="رمز عبور" required minlength="6">
    <button class="primary" type="submit">ساخت ادمین</button>
  </form>`;

  const body = `
    <section class="panel">
      <h2>مدیریت کاربران</h2>
      ${adminTabs("users")}
      <h3>ساخت ادمین جدید</h3>
      ${createForm}
      <h3>کاربران</h3>
      ${entries.map((entry) => userRow(entry, user)).join("") || `<p class="hint">کاربری وجود ندارد.</p>`}
    </section>`;
  return layout({ title: "مدیریت کاربران | مدیری‌نیوز", user, flash, body });
}

function commentRow(comment) {
  const pending = comment.status !== "approved";
  const replyForm = `<form method="post" action="/admin/comments/${comment.id}/reply" class="form reply-form">
    <input name="reply" placeholder="${pending ? "پاسخ ادمین (نظر تأیید و منتشر می‌شود)" : "پاسخ ادمین"}" maxlength="800" required>
    <button class="primary" type="submit">${pending ? "ثبت پاسخ و تأیید" : "ثبت پاسخ"}</button>
  </form>`;
  const buttons = [];
  if (comment.status !== "approved") {
    buttons.push(`<form method="post" action="/admin/comments/${comment.id}/approve" class="inline"><button type="submit">تأیید</button></form>`);
  }
  buttons.push(`<form method="post" action="/admin/comments/${comment.id}/reject" class="inline"><button type="submit">رد</button></form>`);
  buttons.push(`<form method="post" action="/admin/comments/${comment.id}/delete" class="inline"><button type="submit" class="danger">حذف</button></form>`);

  return `<div class="comment admin-comment">
    <div class="comment-head">${esc(comment.username)} · ${esc(
      formatFull(parseDate(comment.created_at))
    )} · <span class="badge ${comment.status}">${
      comment.status === "pending" ? "در انتظار" : comment.status === "approved" ? "تأییدشده" : "ردشده"
    }</span></div>
    <p>${esc(comment.body)}</p>
    <p class="hint">خبر: <a class="text-link" href="/news/${comment.article_id}">${esc(
      comment.article_title
    )}</a></p>
    ${comment.admin_reply ? `<div class="reply"><strong>پاسخ:</strong> ${esc(comment.admin_reply)}</div>` : ""}
    <div class="row-actions">${buttons.join("")}</div>
    ${replyForm}
  </div>`;
}

export function adminCommentsPage({ user, flash, comments, status }) {
  const tabs = [
    ["pending", "در انتظار"],
    ["approved", "تأییدشده"],
  ]
    .map(
      ([key, label]) =>
        `<a href="/admin/comments?status=${key}" class="${status === key ? "active" : ""}">${label}</a>`
    )
    .join("");
  const body = `
    <section class="panel">
      <h2>مدیریت نظرها</h2>
      ${adminTabs("comments")}
      <nav class="tabs sub">${tabs}</nav>
      ${comments.map(commentRow).join("") || `<p class="hint">نظری در این بخش نیست.</p>`}
    </section>`;
  return layout({ title: "مدیریت نظرها | مدیری‌نیوز", user, flash, body });
}

function messageRow(message) {
  const unread = !message.read_at;
  const badge = unread ? `<span class="badge pending">خوانده‌نشده</span>` : "";
  const readButton = unread
    ? `<form method="post" action="/admin/messages/${message.id}/read" class="inline"><button type="submit">خوانده شد</button></form>`
    : "";
  return `<div class="comment admin-comment${unread ? " unread" : ""}">
    <div class="comment-head">${esc(message.username)} ${badge} · ${esc(
      formatFull(parseDate(message.created_at))
    )}</div>
    <p>${esc(message.body)}</p>
    <div class="row-actions">${readButton}
      <form method="post" action="/admin/messages/${message.id}/delete" class="inline"><button type="submit" class="danger">حذف</button></form>
    </div>
  </div>`;
}

export function adminMessagesPage({ user, flash, messages }) {
  const body = `
    <section class="panel">
      <h2>پیام‌های کاربران</h2>
      ${adminTabs("messages")}
      ${messages.map(messageRow).join("") || `<p class="hint">پیامی وجود ندارد.</p>`}
    </section>`;
  return layout({ title: "پیام‌ها | مدیری‌نیوز", user, flash, body });
}

export function errorPage({ user, title, message }) {
  return layout({
    title: `${title} | مدیری‌نیوز`,
    user,
    body: `<section class="empty"><h2>${esc(title)}</h2><p>${esc(message)}</p><p><a class="text-link" href="/">بازگشت به خانه</a></p></section>`,
  });
}

function shorten(value, max = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function forumPager(base, page, totalPages, extra = "") {
  if (totalPages <= 1) return "";
  const href = (target) => `${base}?page=${target}${extra}`;
  const previous =
    page > 1
      ? `<a class="pager-link" href="${href(page - 1)}">قبلی</a>`
      : `<span class="pager-link disabled">قبلی</span>`;
  const next =
    page < totalPages
      ? `<a class="pager-link" href="${href(page + 1)}">بعدی</a>`
      : `<span class="pager-link disabled">بعدی</span>`;
  return `<nav class="pager" aria-label="صفحه‌بندی">${previous}<span class="pager-status">صفحه ${fa(
    page
  )} از ${fa(totalPages)}</span>${next}</nav>`;
}

function forumCrumb(parts) {
  return `<p class="tagline">${parts
    .map(([href, label]) => (href ? `<a class="text-link" href="${href}">${esc(label)}</a>` : esc(label)))
    .join(` <span class="dot">·</span> `)}</p>`;
}

function forumLikeForm(post) {
  const liked = Boolean(post.liked);
  return `<form method="post" action="/forum/post/${post.id}/like" class="like-form">
    <button type="submit" class="like action-pill ${liked ? "liked" : ""}" data-label-on="پسندیده" data-label-off="پسند" aria-label="${
      liked ? "برداشتن پسند" : "پسندیدن"
    }" aria-pressed="${liked ? "true" : "false"}">
      <span aria-hidden="true" class="like-heart">♥</span>
      <span class="like-label">${liked ? "پسندیده" : "پسند"}</span>
      <span class="like-count">${fa(post.like_count || 0)}</span>
    </button>
  </form>`;
}

function postCard(post, thread, user, now) {
  const canEdit = user && (user.id === post.user_id || user.role === "admin");
  const canDelete = canEdit;
  const actions = [forumLikeForm(post)];
  if (user && !thread.locked) {
    actions.push(
      `<a class="action-pill comments-link" href="/forum/thread/${thread.id}?quote=${post.id}#reply">نقل قول</a>`
    );
  }
  if (canEdit) {
    actions.push(`<a class="action-pill comments-link" href="/forum/post/${post.id}/edit">ویرایش</a>`);
  }
  if (canDelete) {
    actions.push(
      `<form method="post" action="/forum/post/${post.id}/delete" class="inline" onsubmit="return confirm('این پیام حذف شود؟')"><button type="submit" class="danger-link">حذف</button></form>`
    );
  }
  const quote = post.quote_username
    ? `<blockquote class="quote"><strong>${esc(post.quote_username)}:</strong> ${esc(
        shorten(post.quote_body, 200)
      )}</blockquote>`
    : "";
  return `<div class="post" id="post-${post.id}">
    <div class="post-side">
      <span class="avatar" aria-hidden="true">${esc(post.username.trim().charAt(0) || "؟")}</span>
      <strong>${esc(post.username)}</strong>
      ${post.role === "admin" ? `<span class="badge active">ادمین</span>` : ""}
      <span class="hint">${fa(post.author_posts || 0)} پیام</span>
    </div>
    <div class="post-main">
      <div class="post-head hint">${relative(parseDate(post.created_at), now)}${
        post.edited_at ? " · ویرایش‌شده" : ""
      }</div>
      ${quote}
      <p class="post-body">${esc(post.body).replace(/\n/g, "<br>")}</p>
      <div class="post-actions">${actions.join("")}</div>
    </div>
  </div>`;
}

export function forumIndexPage({ user, flash, boards, stats, results, term, now }) {
  const boardRows = boards
    .map(
      (board) => `<a class="board" href="/forum/board/${board.id}">
        <div class="board-main">
          <strong>${esc(board.title)}</strong>
          <span class="hint">${esc(board.description)}</span>
        </div>
        <div class="board-meta">
          <span>${fa(board.thread_count)} رشته</span>
          <span>${fa(board.post_count)} پیام</span>
        </div>
        <div class="board-last hint">${
          board.last_title
            ? `آخرین رشته: <span class="fg">${esc(shorten(board.last_title, 40))}</span> · ${esc(
                board.last_username
              )} · ${relative(parseDate(board.last_at), now)}`
            : "هنوز رشته‌ای ساخته نشده"
        }</div>
      </a>`
    )
    .join("");

  const searchResults = term
    ? `<section class="panel">
        <h2>نتایج جست‌وجو برای «${esc(term)}»</h2>
        ${
          results.length
            ? `<div class="thread-list">${results
                .map(
                  (row) => `<a class="thread-row" href="/forum/thread/${row.id}">
                    <div class="thread-main">
                      <strong>${esc(row.title)}</strong>
                      <span class="hint">${esc(row.board_title)} · ${esc(row.username)} · ${relative(
                        parseDate(row.updated_at),
                        now
                      )}</span>
                    </div>
                  </a>`
                )
                .join("")}</div>`
            : `<p class="hint">رشته‌ای با این عبارت پیدا نشد.</p>`
        }
      </section>`
    : "";

  const body = `
    <section class="panel">
      <h2>فروم مدیری‌نیوز</h2>
      <p class="hint">گفت‌وگوی جامعه‌ی کاربران؛ رشته بسازید، پاسخ دهید و پیام‌های مفید را بپسندید.</p>
      <form method="get" action="/forum" class="form forum-search">
        <input name="q" value="${esc(term)}" placeholder="جست‌وجو در عنوان رشته‌ها و متن پیام‌ها" maxlength="80">
        <button type="submit">جست‌وجو</button>
      </form>
    </section>
    ${searchResults}
    <section class="panel">
      <div class="board-list">${boardRows || `<p class="hint">تابلویی وجود ندارد.</p>`}</div>
    </section>
    <section class="panel">
      <h2>آمار فروم</h2>
      <div class="stats-grid">
        <div class="stat"><strong>${fa(stats.threads)}</strong><span>رشته</span></div>
        <div class="stat"><strong>${fa(stats.posts)}</strong><span>پیام</span></div>
        <div class="stat"><strong>${fa(stats.members)}</strong><span>عضو فعال</span></div>
        <div class="stat"><strong>${esc(stats.newestMember || "—")}</strong><span>تازه‌ترین عضو</span></div>
      </div>
    </section>`;
  return layout({
    title: "فروم | مدیری‌نیوز",
    user,
    flash,
    header: forumCrumb([["/", "خانه"], [null, "فروم"]]),
    body,
  });
}

export function forumBoardPage({ user, flash, board, threads, page, totalPages, now }) {
  const rows = threads.length
    ? `<div class="thread-list">${threads
        .map(
          (thread) => `<a class="thread-row" href="/forum/thread/${thread.id}">
            <div class="thread-main">
              <strong>${thread.pinned ? `<span class="badge pending">سنجاق</span> ` : ""}${
                thread.locked ? `<span class="badge blocked">قفل</span> ` : ""
              }${esc(thread.title)}</strong>
              <span class="hint">${esc(thread.username)} · ${relative(parseDate(thread.created_at), now)}</span>
            </div>
            <div class="thread-meta">
              <span>${fa(Math.max(0, (thread.post_count || 1) - 1))} پاسخ</span>
              <span>${fa(thread.views || 0)} بازدید</span>
              <span>${fa(thread.like_count || 0)} پسند</span>
            </div>
            <div class="thread-last hint">${
              thread.last_username
                ? `آخرین پیام: ${esc(thread.last_username)} · ${relative(parseDate(thread.updated_at), now)}`
                : ""
            }</div>
          </a>`
        )
        .join("")}</div>`
    : `<p class="hint">هنوز رشته‌ای در این تابلو ساخته نشده است.</p>`;

  const body = `
    <section class="panel">
      <div class="forum-toolbar">
        <div>
          <h2>${esc(board.title)}</h2>
          <p class="hint">${esc(board.description)}</p>
        </div>
        ${
          user
            ? `<a class="button-link" href="/forum/new?board=${board.id}">رشته تازه</a>`
            : `<a class="button-link" href="/login?next=%2Fforum%2Fnew">ورود برای ساخت رشته</a>`
        }
      </div>
      ${rows}
      ${forumPager(`/forum/board/${board.id}`, page, totalPages)}
    </section>`;
  return layout({
    title: `${board.title} | فروم مدیری‌نیوز`,
    user,
    flash,
    header: forumCrumb([["/", "خانه"], ["/forum", "فروم"], [null, board.title]]),
    body,
  });
}

export function forumThreadPage({ user, flash, thread, posts, page, totalPages, now, quote }) {
  const isAdmin = user?.role === "admin";
  const controls = isAdmin
    ? `<div class="row-actions">
        <form method="post" action="/forum/thread/${thread.id}/pin" class="inline"><button type="submit">${
          thread.pinned ? "برداشتن سنجاق" : "سنجاق"
        }</button></form>
        <form method="post" action="/forum/thread/${thread.id}/lock" class="inline"><button type="submit">${
          thread.locked ? "باز کردن قفل" : "قفل"
        }</button></form>
        <form method="post" action="/forum/thread/${thread.id}/delete" class="inline" onsubmit="return confirm('این رشته با همه پیام‌هایش حذف شود؟')"><button type="submit" class="danger">حذف رشته</button></form>
      </div>`
    : "";

  const canReply = user && (!thread.locked || isAdmin);
  const replyForm = canReply
    ? `<form method="post" action="/forum/thread/${thread.id}/reply" class="form" id="reply">
        ${quote ? `<input type="hidden" name="quote_post_id" value="${quote.id}">` : ""}
        ${
          quote
            ? `<div class="quote"><strong>نقل قول از ${esc(quote.username)}:</strong> ${esc(
                shorten(quote.body, 200)
              )}</div>`
            : ""
        }
        <label for="reply-body">پاسخ شما</label>
        <textarea id="reply-body" name="body" rows="4" maxlength="4000" required></textarea>
        <button class="primary" type="submit">ثبت پاسخ</button>
      </form>`
    : thread.locked
      ? `<p class="notice">این رشته قفل شده است و فقط ادمین می‌تواند پاسخ دهد.</p>`
      : `<p class="hint">برای پاسخ دادن <a class="text-link" href="/login?next=${encodeURIComponent(
          `/forum/thread/${thread.id}`
        )}">وارد شوید</a>.</p>`;

  const body = `
    <section class="panel">
      <div class="forum-toolbar">
        <div>
          <h2>${thread.pinned ? `<span class="badge pending">سنجاق</span> ` : ""}${
            thread.locked ? `<span class="badge blocked">قفل</span> ` : ""
          }${esc(thread.title)}</h2>
          <p class="hint">${esc(thread.board_title)} · ${esc(thread.username)} · ${formatFull(
            parseDate(thread.created_at)
          )} · ${fa(thread.views || 0)} بازدید</p>
        </div>
      </div>
      ${controls}
      <div class="post-list">${posts.map((post) => postCard(post, thread, user, now)).join("")}</div>
      ${forumPager(`/forum/thread/${thread.id}`, page, totalPages)}
      ${replyForm}
    </section>`;
  return layout({
    title: `${thread.title} | فروم مدیری‌نیوز`,
    user,
    flash,
    header: forumCrumb([
      ["/", "خانه"],
      ["/forum", "فروم"],
      [`/forum/board/${thread.board_id}`, thread.board_title],
      [null, shorten(thread.title, 40)],
    ]),
    body,
  });
}

export function forumNewThreadPage({ user, flash, boards, boardId }) {
  const body = `
    <section class="panel narrow">
      <h2>رشته تازه</h2>
      <form method="post" action="/forum/threads" class="form">
        <label for="board_id">تابلو</label>
        <select id="board_id" name="board_id">
          ${boards
            .map(
              (board) =>
                `<option value="${board.id}"${board.id === boardId ? " selected" : ""}>${esc(
                  board.title
                )}</option>`
            )
            .join("")}
        </select>
        <label for="title">عنوان رشته</label>
        <input id="title" name="title" maxlength="120" minlength="4" required>
        <label for="body">اولین پیام</label>
        <textarea id="body" name="body" rows="6" maxlength="4000" required></textarea>
        <p class="hint">متن شامل کلمات نامناسب خودکار رد می‌شود.</p>
        <button class="primary" type="submit">ساخت رشته</button>
      </form>
    </section>`;
  return layout({
    title: "رشته تازه | فروم مدیری‌نیوز",
    user,
    flash,
    header: forumCrumb([["/", "خانه"], ["/forum", "فروم"], [null, "رشته تازه"]]),
    body,
  });
}

export function forumEditPostPage({ user, flash, post }) {
  const body = `
    <section class="panel narrow">
      <h2>ویرایش پیام</h2>
      <p class="hint">رشته: <a class="text-link" href="/forum/thread/${post.thread_id}">${esc(
        post.thread_title
      )}</a></p>
      <form method="post" action="/forum/post/${post.id}/edit" class="form">
        <label for="body">متن پیام</label>
        <textarea id="body" name="body" rows="6" maxlength="4000" required>${esc(post.body)}</textarea>
        <button class="primary" type="submit">ذخیره</button>
      </form>
    </section>`;
  return layout({
    title: "ویرایش پیام | فروم مدیری‌نیوز",
    user,
    flash,
    header: forumCrumb([["/", "خانه"], ["/forum", "فروم"], [null, "ویرایش پیام"]]),
    body,
  });
}
