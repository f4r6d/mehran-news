import { dayParts, fa, formatFull, localDayKey, parseDate, relative } from "./jalali.js";

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
  comment_pending: "نظر شما ثبت شد و پس از تأیید ادمین نمایش داده می‌شود.",
  comment_posted: "نظر شما ثبت شد.",
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
  const links = [`<a href="/">خانه</a>`];
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
    <div class="brand"><span class="mark" aria-hidden="true"></span><h1><a href="/">مهران‌نیوز</a></h1></div>
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
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div class="wrap">
  <header class="masthead">
    ${masthead(user)}
    ${header || ""}
  </header>
  ${flashHtml}
  <main>${body}</main>
  <footer>
    <p>منابع: بینگ‌نیوز و گوگل‌نیوز · به‌روزرسانی خودکار هر ۶ ساعت · داده‌ها در Cloudflare D1</p>
  </footer>
</div>
</body>
</html>`;
}

function likeForm(article) {
  return `<form method="post" action="/news/${article.id}/like" class="like-form">
    <button type="submit" class="like ${article.liked ? "liked" : ""}" aria-label="لایک">
      <span aria-hidden="true">♥</span> ${fa(article.like_count || 0)}
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
    `<span class="dot">·</span><a class="comments-link" href="${articleUrl}#comments">${fa(row.comment_count || 0)} نظر</a>` +
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

const EMPTY_STATE = `
<section class="empty">
  <h2>هنوز خبری ذخیره نشده است</h2>
  <p>واکشی اولیه ممکن است چند ثانیه طول بکشد. دکمه را بزنید یا چند لحظه بعد صفحه را تازه کنید.</p>
  <form method="post" action="/refresh"><button class="primary" type="submit">واکشی خبرها</button></form>
</section>`;

export function homePage({ user, rows, stats, flash, now }) {
  const last = stats.lastFetch ? parseDate(stats.lastFetch) : null;
  const updated = last ? relative(last, now) : "—";
  const sections = groupRows(rows, now).map((group) => {
    const cards = group.items.map(({ row, published }) => card(row, published, now)).join("");
    return (
      `<section class="day"><div class="day-head">` +
      `<h2>${esc(group.title)}</h2><span>${esc(group.subtitle)}</span>` +
      `</div>${cards}</section>`
    );
  });

  const header = `
    <p class="tagline">همه‌ی اخبار مهران مدیری، هر روز و یک‌جا — از رسانه‌های فارسی و انگلیسی.</p>
    <div class="status">
      <span>${fa(stats.count)} خبر</span>
      <span class="sep">·</span>
      <span>${fa(stats.sources)} منبع</span>
      <span class="sep">·</span>
      <span>آخرین به‌روزرسانی ${updated}</span>
      <form class="refresh inline" method="post" action="/refresh"><button type="submit">به‌روزرسانی</button></form>
    </div>`;

  return layout({
    title: "مهران‌نیوز | اخبار مهران مدیری",
    user,
    flash,
    header,
    body: sections.join("") || EMPTY_STATE,
  });
}

export function articlePage({ user, article, comments, flash, now }) {
  const published = parseDate(article.published_at);
  const commentItems = comments
    .map((comment) => {
      const reply = comment.admin_reply
        ? `<div class="reply"><strong>پاسخ ادمین:</strong> ${esc(comment.admin_reply)}</div>`
        : "";
      return `<div class="comment"><div class="comment-head">${esc(comment.username)} · ${relative(
        parseDate(comment.created_at),
        now
      )}</div><p>${esc(comment.body)}</p>${reply}</div>`;
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

  return layout({ title: `${article.title} | مهران‌نیوز`, user, flash, header, body });
}

export function loginPage({ user, flash, next }) {
  const body = `
    <section class="panel narrow">
      <h2>ورود</h2>
      <p class="hint">ورود برای ادمین و کاربران یکسان است؛ دسترسی‌ها بر اساس نقش تعیین می‌شود.</p>
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
  return layout({ title: "ورود | مهران‌نیوز", user, flash, body });
}

export function registerPage({ user, flash }) {
  const body = `
    <section class="panel narrow">
      <h2>ثبت‌نام</h2>
      <p class="hint">پس از ثبت‌نام، حساب شما در انتظار تأیید ادمین می‌ماند.</p>
      <form method="post" action="/register" class="form">
        <label for="username">نام کاربری</label>
        <input id="username" name="username" autocomplete="username" required minlength="3" maxlength="30">
        <label for="password">رمز عبور</label>
        <input id="password" name="password" type="password" autocomplete="new-password" required minlength="6">
        <button class="primary" type="submit">ثبت‌نام</button>
      </form>
      <p class="hint">حساب دارید؟ <a class="text-link" href="/login">وارد شوید</a>.</p>
    </section>`;
  return layout({ title: "ثبت‌نام | مهران‌نیوز", user, flash, body });
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
       <p class="hint">شناسه چت: <span dir="ltr">${esc(user.telegram_chat_id)}</span></p>
       ${
         user.notify_allowed
           ? `<form method="post" action="/panel/notify" class="form inline-form">
                <label class="check"><input type="checkbox" name="enabled" value="1" ${
                  user.notify_enabled ? "checked" : ""
                }> دریافت پیام در تلگرام</label>
                <button class="primary" type="submit">ذخیره</button>
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
         <p dir="ltr" class="mono">${esc(linkUrl)}</p>
         <p class="hint">لینک را باز کنید و در تلگرام دکمه Start را بزنید.</p></div>`
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
      <form method="post" action="/panel/phone" class="form">
        <label for="phone">شماره موبایل (اختیاری)</label>
        <input id="phone" name="phone" dir="ltr" inputmode="tel" value="${esc(user.phone || "")}" placeholder="09xxxxxxxxx">
        <button type="submit">ذخیره شماره</button>
      </form>
    </section>`;
  return layout({ title: "پنل من | مهران‌نیوز", user, flash, body });
}

function adminTabs(active) {
  const tabs = [
    ["overview", "/admin", "نمای کلی"],
    ["news", "/admin/news", "اخبار"],
    ["archive", "/admin/archive", "آرشیو"],
    ["users", "/admin/users", "کاربران"],
    ["comments", "/admin/comments", "نظرها"],
  ];
  return `<nav class="tabs">${tabs
    .map(
      ([key, href, label]) =>
        `<a href="${href}" class="${active === key ? "active" : ""}">${esc(label)}</a>`
    )
    .join("")}</nav>`;
}

export function adminOverviewPage({ user, flash, stats }) {
  const body = `
    <section class="panel">
      <h2>پنل مدیریت</h2>
      ${adminTabs("overview")}
      <div class="stats-grid">
        <div class="stat"><strong>${fa(stats.count)}</strong><span>خبر فعال</span></div>
        <div class="stat"><strong>${fa(stats.archived)}</strong><span>خبر آرشیو</span></div>
        <div class="stat"><strong>${fa(stats.pendingComments)}</strong><span>نظر در انتظار</span></div>
        <div class="stat"><strong>${fa(stats.pendingUsers)}</strong><span>کاربر در انتظار</span></div>
        <div class="stat"><strong>${fa(stats.users)}</strong><span>کل کاربران</span></div>
      </div>
      <p class="hint"><a class="text-link" href="/admin/comments?status=pending">بررسی نظرهای در انتظار</a> · <a class="text-link" href="/admin/users">مدیریت کاربران</a></p>
    </section>`;
  return layout({ title: "پنل مدیریت | مهران‌نیوز", user, flash, body });
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
  return layout({ title: "مدیریت اخبار | مهران‌نیوز", user, flash, body });
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
  return layout({ title: "مدیریت کاربران | مهران‌نیوز", user, flash, body });
}

function commentRow(comment) {
  const replyForm = `<form method="post" action="/admin/comments/${comment.id}/reply" class="form reply-form">
    <input name="reply" placeholder="پاسخ ادمین" maxlength="800" required>
    <button class="primary" type="submit">ثبت پاسخ</button>
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
    ${comment.status === "approved" ? replyForm : ""}
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
  return layout({ title: "مدیریت نظرها | مهران‌نیوز", user, flash, body });
}

export function errorPage({ user, title, message }) {
  return layout({
    title: `${title} | مهران‌نیوز`,
    user,
    body: `<section class="empty"><h2>${esc(title)}</h2><p>${esc(message)}</p><p><a class="text-link" href="/">بازگشت به خانه</a></p></section>`,
  });
}
