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
  setBotUiMessage,
  setCommentStatus,
  setUserStatus,
  setUserTelegram,
  consumeLinkToken,
} from "./db.js";

const API = "https://api.telegram.org";
const MAX_MESSAGES_PER_RUN = 40;

const BTN = {
  profile: "پروفایل من",
  notify: "اعلان‌ها",
  news: "آخرین اخبار",
  admin: "مدیریت",
  pendingComments: "نظرهای در انتظار",
  pendingUsers: "کاربران در انتظار",
  adminNews: "مدیریت اخبار",
  back: "بازگشت",
  close: "بستن منو",
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
  BTN.close,
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

function mainKeyboard(isAdmin) {
  const rows = [
    [{ text: BTN.profile }, { text: BTN.notify }],
    [{ text: BTN.news }],
  ];
  if (isAdmin) {
    rows.push([{ text: BTN.pendingComments }, { text: BTN.pendingUsers }]);
    rows.push([{ text: BTN.adminNews }]);
  }
  rows.push([{ text: BTN.back }, { text: BTN.close }]);
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
      await setBotUiMessage(env.DB, chatId, messageId);
      return messageId;
    }
  }
  const sent = await call(env, "sendMessage", payload);
  const id = sent?.result?.message_id || null;
  if (id) await setBotUiMessage(env.DB, chatId, id);
  return id;
}

async function currentMessageId(env, chatId) {
  const state = await getBotState(env.DB, chatId);
  return state?.message_id || null;
}

async function showMain(env, chatId, messageId) {
  await render(
    env,
    chatId,
    messageId,
    "منوی مهران‌نیوز\nاز دکمه‌های پایین صفحه انتخاب کنید.",
    null
  );
}

async function sendMenu(env, chatId, text, isAdmin) {
  const sent = await sendMessage(env, chatId, text, mainKeyboard(isAdmin));
  const id = sent?.result?.message_id || null;
  if (id) await setBotUiMessage(env.DB, chatId, id);
  return id;
}

async function showAdmin(env, chatId, messageId, prefix = "") {
  const [pendingComments, pendingUsers] = await Promise.all([
    countComments(env.DB, "pending"),
    countUsers(env.DB, "pending"),
  ]);
  await render(
    env,
    chatId,
    messageId,
    `${prefix ? `${prefix}\n\n` : ""}پنل مدیریت\nنظرهای در انتظار: ${pendingComments}\nکاربران در انتظار: ${pendingUsers}`,
    {
      inline_keyboard: [
        [
          { text: BTN.pendingComments, callback_data: "admc:0" },
          { text: BTN.pendingUsers, callback_data: "admu:0" },
        ],
        [{ text: BTN.adminNews, callback_data: "admnews:0" }],
      ],
    }
  );
}

function clampOffset(offset, length) {
  if (!length) return 0;
  return ((offset % length) + length) % length;
}

async function showComment(env, chatId, messageId, offset = 0) {
  const comments = await listCommentsForAdmin(env.DB, "pending");
  if (!comments.length) {
    return render(env, chatId, messageId, "نظر در انتظاری وجود ندارد.", {
      inline_keyboard: [[{ text: BTN.back, callback_data: "admin" }]],
    });
  }
  const index = clampOffset(offset, comments.length);
  const comment = comments[index];
  const text =
    `نظر #${comment.id} از ${comment.username}\n` +
    `«${comment.body}»\n\n` +
    `خبر: ${comment.article_title}\n` +
    `${index + 1} از ${comments.length}`;
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
      [
        { text: "بعدی", callback_data: `admc:${index + 1}` },
        { text: BTN.back, callback_data: "admin" },
      ],
    ],
  });
}

async function showUser(env, chatId, messageId, offset = 0) {
  const users = await listUsers(env.DB, "pending");
  if (!users.length) {
    return render(env, chatId, messageId, "کاربر در انتظاری وجود ندارد.", {
      inline_keyboard: [[{ text: BTN.back, callback_data: "admin" }]],
    });
  }
  const index = clampOffset(offset, users.length);
  const entry = users[index];
  const text = `کاربر ${entry.username} در انتظار تأیید است.\n${index + 1} از ${users.length}`;
  return render(env, chatId, messageId, text, {
    inline_keyboard: [
      [
        { text: "تأیید", callback_data: `ua:${entry.id}:${index}` },
        { text: "بلاک", callback_data: `ub:${entry.id}:${index}` },
      ],
      [
        { text: "بعدی", callback_data: `admu:${index + 1}` },
        { text: BTN.back, callback_data: "admin" },
      ],
    ],
  });
}

async function showAdminNews(env, chatId, messageId, offset = 0) {
  const articles = await listArticles(env.DB, 20, 0, 0);
  if (!articles.length) {
    return render(env, chatId, messageId, "خبری برای مدیریت وجود ندارد.", {
      inline_keyboard: [[{ text: BTN.back, callback_data: "admin" }]],
    });
  }
  const index = clampOffset(offset, articles.length);
  const article = articles[index];
  const text =
    `${article.title}\n` +
    `${article.source || ""}\n` +
    `${index + 1} از ${articles.length}`;
  return render(env, chatId, messageId, text, {
    inline_keyboard: [
      [
        { text: "آرشیو", callback_data: `aa:${article.id}:${index}` },
        { text: "حذف", callback_data: `ad:${article.id}:${index}` },
      ],
      [{ text: "مشاهده خبر", url: `${env.SITE_URL || "https://example.com"}/news/${article.id}` }],
      [
        { text: "بعدی", callback_data: `admnews:${index + 1}` },
        { text: BTN.back, callback_data: "admin" },
      ],
    ],
  });
}

async function sendArticleDigestToUser(env, user, articles) {
  const lines = articles
    .slice(0, 3)
    .map((article) => `${article.title}\n${article.url}`)
    .join("\n\n");
  return sendMessage(env, user.telegram_chat_id, `خبر تازه درباره مهران مدیری:\n\n${lines}`);
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
    `خبر: ${comment.article_title}\n${comment.article_url}`;
  const result = await sendMessage(env, comment.telegram_chat_id, text);
  return Boolean(result?.ok);
}

async function showProfile(env, user, chatId, messageId) {
  const notify = user.notify_enabled && user.notify_allowed ? "روشن" : "خاموش";
  const text =
    `نام کاربری: ${user.username}\n` +
    `نقش: ${user.role === "admin" ? "ادمین" : "کاربر"}\n` +
    `اعلان‌ها: ${notify}` +
    (user.notify_allowed ? "" : "\n(اجازه اعلان توسط ادمین غیرفعال است)") +
    (env.SITE_URL ? `\nسایت: ${env.SITE_URL}` : "");
  await render(env, chatId, messageId, text, null);
}

async function showNews(env, chatId, messageId) {
  const articles = await listArticles(env.DB, 5, 0, 0);
  const text = articles.length
    ? articles.map((article) => `${article.title}\n${article.url}`).join("\n\n")
    : "هنوز خبری ذخیره نشده است.";
  await render(env, chatId, messageId, text, null);
}

async function handleCallback(env, update) {
  const callback = update.callback_query;
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;
  const data = callback.data || "";
  await call(env, "answerCallbackQuery", { callback_query_id: callback.id });
  if (!chatId) return;

  const user = await getUserByChatId(env.DB, chatId);
  if (!user || user.status !== "active") {
    await sendMessage(env, chatId, "حساب تلگرام شما به سایت متصل نیست یا فعال نیست.");
    return;
  }

  const isAdmin = user.role === "admin";
  const [action, rawId, rawOffset] = data.split(":");
  const id = Number(rawId);
  const offset = Number(rawOffset) || 0;

  if (data === "admin") {
    if (isAdmin) return showAdmin(env, chatId, messageId);
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }
  if (data === "profile") return showProfile(env, user, chatId, messageId);
  if (data === "notify") {
    return toggleNotify(env, user, chatId, messageId);
  }
  if (data === "news") return showNews(env, chatId, messageId);

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
    return render(env, chatId, messageId, `پاسخ به نظر #${id} را بنویسید.`, {
      inline_keyboard: [[{ text: "انصراف", callback_data: `admc:${offset}` }]],
    });
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

async function toggleNotify(env, user, chatId, messageId) {
  if (!user.notify_allowed) {
    return render(env, chatId, messageId, "اجازه دریافت اعلان برای شما غیرفعال است. با ادمین تماس بگیرید.", null);
  }
  const enabled = !user.notify_enabled;
  await env.DB.prepare("UPDATE users SET notify_enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, user.id)
    .run();
  return render(env, chatId, messageId, `اعلان‌ها ${enabled ? "روشن" : "خاموش"} شد.`, null);
}

async function handleLinkedMenu(env, user, text, chatId, messageId) {
  if (text === BTN.close) {
    await call(env, "sendMessage", {
      chat_id: chatId,
      text: "منو بسته شد. برای باز کردن دوباره /start را بزنید.",
      reply_markup: { remove_keyboard: true },
    });
    return;
  }
  if (text === BTN.back) {
    if (user.role === "admin") return showAdmin(env, chatId, messageId);
    return showMain(env, chatId, messageId);
  }
  if (text === BTN.profile) return showProfile(env, user, chatId, messageId);
  if (text === BTN.notify) {
    return toggleNotify(env, user, chatId, messageId);
  }
  if (text === BTN.news) return showNews(env, chatId, messageId);

  if (text === BTN.admin) {
    if (user.role === "admin") return showAdmin(env, chatId, messageId);
    return render(env, chatId, messageId, "شما دسترسی مدیریتی ندارید.", null);
  }
  if (text === BTN.pendingComments) {
    if (user.role === "admin") return showComment(env, chatId, messageId, 0);
    return render(env, chatId, messageId, "شما دسترسی مدیریتی ندارید.", null);
  }
  if (text === BTN.pendingUsers) {
    if (user.role === "admin") return showUser(env, chatId, messageId, 0);
    return render(env, chatId, messageId, "شما دسترسی مدیریتی ندارید.", null);
  }
  if (text === BTN.adminNews) {
    if (user.role === "admin") return showAdminNews(env, chatId, messageId, 0);
    return render(env, chatId, messageId, "شما دسترسی مدیریتی ندارید.", null);
  }
  return showMain(env, chatId, messageId);
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
      await sendMenu(
        env,
        chatId,
        "حساب تلگرام شما با موفقیت به مهران‌نیوز متصل شد.\n\nاز دکمه‌های پایین صفحه انتخاب کنید.",
        user?.role === "admin"
      );
      return;
    }
    if (user) {
      await sendMenu(
        env,
        chatId,
        "منوی مهران‌نیوز\nاز دکمه‌های پایین صفحه انتخاب کنید.",
        user.role === "admin"
      );
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

  const messageId = await currentMessageId(env, chatId);
  const state = await getBotState(env.DB, chatId);

  if (state?.action === "reply" && state.comment_id && text && !MENU_COMMANDS.has(text)) {
    if (user.role !== "admin") {
      await setBotState(env.DB, chatId, "ui", null);
      return render(env, chatId, messageId, "شما دسترسی مدیریتی ندارید.", null);
    }
    await replyToComment(env.DB, state.comment_id, text.slice(0, 800), user.id);
    const comment = await getComment(env.DB, state.comment_id);
    await notifyReply(env, comment);
    await setBotState(env.DB, chatId, "ui", null);
    return showAdmin(env, chatId, messageId, `پاسخ ثبت شد و نظر #${state.comment_id} تأیید شد.`);
  }

  if (state?.action === "reply" && MENU_COMMANDS.has(text)) {
    await setBotState(env.DB, chatId, "ui", null);
  }

  if (text === "/menu" || text === "منو") {
    return showMain(env, chatId, messageId);
  }

  return handleLinkedMenu(env, user, text, chatId, messageId);
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
