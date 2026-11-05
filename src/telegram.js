import {
  countComments,
  countUsers,
  deleteArticleRow,
  deleteCommentRow,
  getBotState,
  getComment,
  getUserByChatId,
  listArticles,
  listCommentsForAdmin,
  listNotifyTargets,
  listUsers,
  replyToComment,
  setArticleArchived,
  setBotState,
  setCommentStatus,
  setUserStatus,
  setUserTelegram,
  consumeLinkToken,
} from "./db.js";

const API = "https://api.telegram.org";
const MAX_MESSAGES_PER_RUN = 40;
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function fa(value) {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[digit]);
}

const BTN = {
  profile: "پروفایل من",
  notify: "اعلان‌ها",
  news: "آخرین اخبار",
  admin: "مدیریت",
  pendingComments: "نظرهای در انتظار",
  pendingUsers: "کاربران در انتظار",
  adminNews: "مدیریت اخبار",
  back: "بک",
};

const MENU_COMMANDS = new Set([
  "/start",
  "/menu",
  "منو",
  BTN.profile,
  BTN.notify,
  BTN.news,
  BTN.admin,
  BTN.pendingComments,
  BTN.pendingUsers,
  BTN.adminNews,
  BTN.back,
]);

export function botConfigured(env) {
  return Boolean(env?.TELEGRAM_BOT_TOKEN);
}

export function botLink(env) {
  const username = env?.TELEGRAM_BOT_USERNAME;
  return username ? `https://t.me/${username.replace(/^@/, "")}` : null;
}

async function call(env, method, payload = {}) {
  if (!botConfigured(env)) return { ok: false };
  try {
    const response = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return await response.json().catch(() => ({ ok: response.ok }));
  } catch (error) {
    console.warn("telegram call failed", method, error?.message || error);
    return { ok: false };
  }
}

export async function sendMessage(env, chatId, text, keyboard) {
  const payload = {
    chat_id: chatId,
    text: String(text).slice(0, 4000),
    disable_web_page_preview: true,
  };
  if (keyboard) payload.reply_markup = keyboard;
  return call(env, "sendMessage", payload);
}

async function answerCallback(env, callbackId, text) {
  const payload = { callback_query_id: callbackId };
  if (text) {
    payload.text = text;
    payload.show_alert = true;
  }
  return call(env, "answerCallbackQuery", payload);
}

function mainKeyboard(isAdmin) {
  const rows = [
    [{ text: BTN.profile }, { text: BTN.notify }],
    [{ text: BTN.news }],
  ];
  if (isAdmin) {
    rows.push([{ text: BTN.pendingComments }, { text: BTN.pendingUsers }]);
    rows.push([{ text: BTN.adminNews }]);
  }
  rows.push([{ text: BTN.back }]);
  return { keyboard: rows, resize_keyboard: true, is_persistent: true };
}

async function render(env, chatId, messageId, text, inline) {
  const payload = {
    chat_id: chatId,
    text: String(text).slice(0, 4000),
    disable_web_page_preview: true,
    reply_markup: inline || { inline_keyboard: [] },
  };
  if (messageId) {
    const edited = await call(env, "editMessageText", { ...payload, message_id: messageId });
    if (edited?.ok || /message is not modified/i.test(edited?.description || "")) {
      return messageId;
    }
  }
  const sent = await call(env, "sendMessage", payload);
  return sent?.result?.message_id || null;
}

async function sendMenu(env, chatId, isAdmin) {
  return sendMessage(
    env,
    chatId,
    "منوی مهران‌نیوز\nاز دکمه‌های پایین صفحه انتخاب کنید.",
    mainKeyboard(isAdmin)
  );
}

async function sendProfile(env, user, chatId) {
  const notify = user.notify_enabled && user.notify_allowed ? "روشن" : "خاموش";
  const text =
    `نام کاربری: ${user.username}\n` +
    `نقش: ${user.role === "admin" ? "ادمین" : "کاربر"}\n` +
    `اعلان‌ها: ${notify}` +
    (user.notify_allowed ? "" : "\n(اجازه اعلان توسط ادمین غیرفعال است)");
  const inline = /^https?:\/\//i.test(env.SITE_URL || "")
    ? { inline_keyboard: [[{ text: "باز کردن سایت", url: env.SITE_URL }]] }
    : undefined;
  return sendMessage(env, chatId, text, inline);
}

async function sendNews(env, chatId) {
  const articles = await listArticles(env.DB, 5, 0, 0);
  if (!articles.length) {
    return sendMessage(env, chatId, "هنوز خبری ذخیره نشده است.");
  }
  const lines = articles.map(
    (article, index) =>
      `${fa(index + 1)}. ${article.title}${article.source ? ` — ${article.source}` : ""}`
  );
  const rows = [];
  articles.forEach((article, index) => {
    if (/^https?:\/\//i.test(article.url || "")) {
      rows.push([{ text: `باز کردن خبر ${fa(index + 1)}`, url: article.url }]);
    }
  });
  return sendMessage(
    env,
    chatId,
    `آخرین اخبار\n\n${lines.join("\n")}`,
    rows.length ? { inline_keyboard: rows } : undefined
  );
}

function notifyKeyboard(enabled) {
  return {
    inline_keyboard: [
      [{ text: enabled ? "اعلان‌ها: روشن" : "اعلان‌ها: خاموش", callback_data: "notify" }],
    ],
  };
}

async function sendNotify(env, user, chatId) {
  if (!user.notify_allowed) {
    return sendMessage(env, chatId, "اجازه دریافت اعلان توسط ادمین غیرفعال شده است.");
  }
  return sendMessage(
    env,
    chatId,
    "برای روشن یا خاموش کردن اعلان‌ها روی دکمه زیر بزنید.",
    notifyKeyboard(Boolean(user.notify_enabled))
  );
}

async function toggleNotify(env, user, chatId, callback) {
  const messageId = callback.message?.message_id;
  if (!messageId) {
    await answerCallback(env, callback.id, "این دکمه قابل تغییر نیست.");
    return;
  }
  if (!user.notify_allowed) {
    await answerCallback(env, callback.id, "اجازه دریافت اعلان توسط ادمین غیرفعال شده است.");
    return;
  }
  const enabled = !user.notify_enabled;
  await env.DB.prepare("UPDATE users SET notify_enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, user.id)
    .run();
  await call(env, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: notifyKeyboard(enabled),
  });
  await answerCallback(env, callback.id);
}

async function sendAdmin(env, chatId, prefix = "") {
  const [pendingComments, pendingUsers] = await Promise.all([
    countComments(env.DB, "pending"),
    countUsers(env.DB, "pending"),
  ]);
  return sendMessage(
    env,
    chatId,
    `${prefix ? `${prefix}\n\n` : ""}پنل مدیریت\n` +
      `نظرهای در انتظار: ${fa(pendingComments)}\n` +
      `کاربران در انتظار: ${fa(pendingUsers)}\n\n` +
      "از دکمه‌های پایین صفحه انتخاب کنید."
  );
}

function clampOffset(offset, length) {
  if (!length) return 0;
  return ((offset % length) + length) % length;
}

async function showComment(env, chatId, messageId, offset = 0) {
  const comments = await listCommentsForAdmin(env.DB, "pending");
  if (!comments.length) {
    return render(env, chatId, messageId, "نظر در انتظاری وجود ندارد.");
  }
  const index = clampOffset(offset, comments.length);
  const comment = comments[index];
  const text =
    `نظر #${fa(comment.id)} از ${comment.username}\n` +
    `«${comment.body}»\n\n` +
    `خبر: ${comment.article_title}\n` +
    `${fa(index + 1)} از ${fa(comments.length)}`;
  return render(env, chatId, messageId, text, {
    inline_keyboard: [
      [
        { text: "تأیید", callback_data: `ca:${comment.id}:${index}` },
        { text: "رد", callback_data: `cr:${comment.id}:${index}` },
      ],
      [
        { text: "حذف", callback_data: `dl:${comment.id}:${index}` },
        { text: "پاسخ", callback_data: `rp:${comment.id}:${index}` },
      ],
      [{ text: "بعدی", callback_data: `admc:${index + 1}` }],
    ],
  });
}

async function showUser(env, chatId, messageId, offset = 0) {
  const users = await listUsers(env.DB, "pending");
  if (!users.length) {
    return render(env, chatId, messageId, "کاربر در انتظاری وجود ندارد.");
  }
  const index = clampOffset(offset, users.length);
  const entry = users[index];
  const text = `کاربر ${entry.username} در انتظار تأیید است.\n${fa(index + 1)} از ${fa(users.length)}`;
  return render(env, chatId, messageId, text, {
    inline_keyboard: [
      [
        { text: "تأیید", callback_data: `ua:${entry.id}:${index}` },
        { text: "بلاک", callback_data: `ub:${entry.id}:${index}` },
      ],
      [{ text: "بعدی", callback_data: `admu:${index + 1}` }],
    ],
  });
}

async function showAdminNews(env, chatId, messageId, offset = 0) {
  const articles = await listArticles(env.DB, 20, 0, 0);
  if (!articles.length) {
    return render(env, chatId, messageId, "خبری برای مدیریت وجود ندارد.");
  }
  const index = clampOffset(offset, articles.length);
  const article = articles[index];
  const text =
    `${article.title}\n` +
    `${article.source || ""}\n` +
    `${fa(index + 1)} از ${fa(articles.length)}`;
  const rows = [
    [
      { text: "آرشیو", callback_data: `aa:${article.id}:${index}` },
      { text: "حذف", callback_data: `ad:${article.id}:${index}` },
    ],
  ];
  if (/^https?:\/\//i.test(env.SITE_URL || "")) {
    rows.push([{ text: "مشاهده خبر", url: `${env.SITE_URL}/news/${article.id}` }]);
  }
  rows.push([{ text: "بعدی", callback_data: `admnews:${index + 1}` }]);
  return render(env, chatId, messageId, text, { inline_keyboard: rows });
}

async function sendArticleDigestToUser(env, user, articles) {
  const selected = articles.slice(0, 3);
  const lines = selected
    .map((article, index) => `${fa(index + 1)}. ${article.title}`)
    .join("\n");
  const rows = [];
  selected.forEach((article, index) => {
    if (/^https?:\/\//i.test(article.url || "")) {
      rows.push([{ text: `خواندن خبر ${fa(index + 1)}`, url: article.url }]);
    }
  });
  return sendMessage(
    env,
    user.telegram_chat_id,
    `خبر تازه درباره مهران مدیری:\n\n${lines}`,
    rows.length ? { inline_keyboard: rows } : undefined
  );
}

export async function notifyNewArticles(env, articles) {
  if (!botConfigured(env) || !articles?.length) return 0;
  const targets = await listNotifyTargets(env.DB);
  let sent = 0;
  for (const user of targets.slice(0, MAX_MESSAGES_PER_RUN)) {
    const result = await sendArticleDigestToUser(env, user, articles);
    if (result?.ok) sent += 1;
  }
  return sent;
}

export async function notifyReply(env, comment) {
  if (!botConfigured(env) || !comment?.telegram_chat_id) return false;
  if (!comment.notify_enabled || !comment.notify_allowed) return false;
  const text =
    `پاسخ ادمین به نظر شما:\n\n«${comment.body}»\n\n` +
    `پاسخ: ${comment.admin_reply}\n\n` +
    `خبر: ${comment.article_title}`;
  const inline = /^https?:\/\//i.test(comment.article_url || "")
    ? { inline_keyboard: [[{ text: "باز کردن خبر", url: comment.article_url }]] }
    : undefined;
  const result = await sendMessage(env, comment.telegram_chat_id, text, inline);
  return Boolean(result?.ok);
}

async function handleCallback(env, update) {
  const callback = update.callback_query;
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const data = callback.data || "";
  if (!chatId) {
    await answerCallback(env, callback.id);
    return;
  }

  const user = await getUserByChatId(env.DB, chatId);
  if (!user || user.status !== "active") {
    await answerCallback(env, callback.id, "حساب تلگرام شما به سایت متصل نیست یا فعال نیست.");
    return;
  }

  if (data === "notify") {
    return toggleNotify(env, user, chatId, callback);
  }

  await answerCallback(env, callback.id);

  const isAdmin = user.role === "admin";
  const [action, rawId, rawOffset] = data.split(":");
  const id = Number(rawId);
  const offset = Number(rawOffset) || 0;

  if (data === "admin") {
    if (isAdmin) return sendAdmin(env, chatId);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }

  if (action === "admc") {
    if (!isAdmin) return;
    return showComment(env, chatId, messageId, offset);
  }
  if (action === "admu") {
    if (!isAdmin) return;
    return showUser(env, chatId, messageId, offset);
  }
  if (action === "admnews") {
    if (!isAdmin) return;
    return showAdminNews(env, chatId, messageId, offset);
  }

  if (!isAdmin) {
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  if (!Number.isInteger(id) || id < 1) return;

  if (action === "ca") {
    await setCommentStatus(env.DB, id, "approved", user.id);
    return showComment(env, chatId, messageId, offset);
  }
  if (action === "cr") {
    await setCommentStatus(env.DB, id, "rejected", user.id);
    return showComment(env, chatId, messageId, offset);
  }
  if (action === "dl") {
    await deleteCommentRow(env.DB, id);
    return showComment(env, chatId, messageId, offset);
  }
  if (action === "rp") {
    await setBotState(env.DB, chatId, "reply", id);
    return sendMessage(env, chatId, `پاسخ به نظر #${fa(id)} را بنویسید.`);
  }
  if (action === "ua") {
    await setUserStatus(env.DB, id, "active", user.id);
    return showUser(env, chatId, messageId, offset);
  }
  if (action === "ub") {
    await setUserStatus(env.DB, id, "blocked", user.id);
    return showUser(env, chatId, messageId, offset);
  }
  if (action === "aa") {
    await setArticleArchived(env.DB, id, 1);
    return showAdminNews(env, chatId, messageId, offset);
  }
  if (action === "ad") {
    await deleteArticleRow(env.DB, id);
    return showAdminNews(env, chatId, messageId, offset);
  }
}

async function handleLinkedMenu(env, user, text, chatId) {
  if (text === BTN.back) {
    await sendMessage(env, chatId, "منو جمع شد. برای باز کردن دوباره /start را بزنید.", {
      remove_keyboard: true,
    });
    return;
  }
  if (text === BTN.profile) return sendProfile(env, user, chatId);
  if (text === BTN.notify) return sendNotify(env, user, chatId);
  if (text === BTN.news) return sendNews(env, chatId);

  if (text === BTN.admin) {
    if (user.role === "admin") return sendAdmin(env, chatId);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  if (text === BTN.pendingComments) {
    if (user.role === "admin") return showComment(env, chatId, null, 0);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  if (text === BTN.pendingUsers) {
    if (user.role === "admin") return showUser(env, chatId, null, 0);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  if (text === BTN.adminNews) {
    if (user.role === "admin") return showAdminNews(env, chatId, null, 0);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  return sendMenu(env, chatId, user.role === "admin");
}

async function handleMessage(env, update) {
  const message = update.message;
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  const username = message.from?.username || null;
  if (!chatId) return;

  let user = await getUserByChatId(env.DB, chatId);

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (token) {
      const userId = await consumeLinkToken(env.DB, token);
      if (!userId) {
        await sendMessage(env, chatId, "لینک اتصال نامعتبر یا منقضی شده است. از پنل کاربری لینک تازه بگیرید.");
        return;
      }
      await setUserTelegram(env.DB, userId, chatId, username);
      user = await getUserByChatId(env.DB, chatId);
      await sendMessage(
        env,
        chatId,
        "حساب تلگرام شما با موفقیت به مهران‌نیوز متصل شد.\n\nاز دکمه‌های پایین صفحه انتخاب کنید.",
        mainKeyboard(user?.role === "admin")
      );
      return;
    }
    if (user) {
      await sendMenu(env, chatId, user.role === "admin");
      return;
    }
    await sendMessage(
      env,
      chatId,
      "برای اتصال، وارد پنل کاربری سایت شوید و دکمه «ساخت لینک اتصال» را بزنید."
    );
    return;
  }

  if (!user) {
    await sendMessage(env, chatId, "ابتدا حساب تلگرام خود را از پنل کاربری سایت متصل کنید.");
    return;
  }

  const state = await getBotState(env.DB, chatId);

  if (state?.action === "reply" && state.comment_id && text && !MENU_COMMANDS.has(text)) {
    if (user.role !== "admin") {
      await setBotState(env.DB, chatId, "ui", null);
      return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
    }
    await replyToComment(env.DB, state.comment_id, text.slice(0, 800), user.id);
    const comment = await getComment(env.DB, state.comment_id);
    await notifyReply(env, comment);
    await setBotState(env.DB, chatId, "ui", null);
    return sendMessage(env, chatId, `پاسخ ثبت شد و نظر #${fa(state.comment_id)} تأیید شد.`);
  }

  if (state?.action === "reply" && MENU_COMMANDS.has(text)) {
    await setBotState(env.DB, chatId, "ui", null);
  }

  if (text === "/menu" || text === "منو") {
    return sendMenu(env, chatId, user.role === "admin");
  }

  return handleLinkedMenu(env, user, text, chatId);
}

export async function handleTelegramWebhook(request, env) {
  if (!botConfigured(env)) {
    return new Response(JSON.stringify({ ok: false, error: "bot not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (
    env.TELEGRAM_WEBHOOK_SECRET &&
    request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    if (update.callback_query) await handleCallback(env, update);
    else if (update.message) await handleMessage(env, update);
  } catch (error) {
    console.error("telegram update failed:", error);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
