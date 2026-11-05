import {
  clearBotState,
  consumeLinkToken,
  getBotState,
  getComment,
  getUserByChatId,
  listArticles,
  listCommentsForAdmin,
  listNotifyTargets,
  listUsers,
  countComments,
  countUsers,
  deleteArticleRow,
  deleteCommentRow,
  replyToComment,
  setArticleArchived,
  setBotState,
  setCommentStatus,
  setUserPhone,
  setUserStatus,
  setUserTelegram,
} from "./db.js";

const API = "https://api.telegram.org";
const MAX_MESSAGES_PER_RUN = 40;

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
  const payload = { chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: false };
  if (keyboard) payload.reply_markup = keyboard;
  return call(env, "sendMessage", payload);
}

function mainKeyboard(env, isAdmin) {
  const rows = [
    [
      { text: "پروفایل من", callback_data: "profile" },
      { text: "اعلان‌ها", callback_data: "notify" },
    ],
    [{ text: "آخرین اخبار", callback_data: "news" }],
  ];
  if (isAdmin) rows.push([{ text: "مدیریت", callback_data: "admin" }]);
  if (env?.SITE_URL) rows.push([{ text: "بازکردن سایت", url: env.SITE_URL }]);
  return { inline_keyboard: rows };
}

function adminKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "نظرهای در انتظار", callback_data: "admc" }],
      [{ text: "کاربران در انتظار", callback_data: "admu" }],
      [{ text: "مدیریت اخبار", callback_data: "admnews" }],
    ],
  };
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

async function showProfile(env, user) {
  const notify = user.notify_enabled && user.notify_allowed ? "روشن" : "خاموش";
  const text =
    `نام کاربری: ${user.username}\n` +
    `نقش: ${user.role === "admin" ? "ادمین" : "کاربر"}\n` +
    `وضعیت: ${user.status === "active" ? "فعال" : user.status}\n` +
    `اعلان‌ها: ${notify}` +
    (user.notify_allowed ? "" : "\n(اجازه اعلان توسط ادمین غیرفعال است)");
  await sendMessage(env, user.telegram_chat_id, text, mainKeyboard(env, user.role === "admin"));
}

async function showNews(env) {
  const articles = await listArticles(env.DB, 5, 0, 0);
  if (!articles.length) {
    return "هنوز خبری ذخیره نشده است.";
  }
  return articles.map((article) => `${article.title}\n${article.url}`).join("\n\n");
}

async function listPendingComments(env, chatId) {
  const comments = await listCommentsForAdmin(env.DB, "pending");
  if (!comments.length) {
    await sendMessage(env, chatId, "نظر در انتظاری وجود ندارد.", adminKeyboard());
    return;
  }
  for (const comment of comments.slice(0, 5)) {
    const text =
      `نظر #${comment.id} از ${comment.username}\n` +
      `«${comment.body}»\n\n` +
      `خبر: ${comment.article_title}`;
    await sendMessage(env, chatId, text, {
      inline_keyboard: [
        [
          { text: "تأیید", callback_data: `ca:${comment.id}` },
          { text: "رد", callback_data: `cr:${comment.id}` },
        ],
        [
          { text: "حذف", callback_data: `dl:${comment.id}` },
          { text: "پاسخ", callback_data: `rp:${comment.id}` },
        ],
      ],
    });
  }
  const total = await countComments(env.DB, "pending");
  if (total > 5) {
    await sendMessage(env, chatId, `و ${total - 5} نظر دیگر در انتظار.`, adminKeyboard());
  }
}

async function listPendingUsers(env, chatId) {
  const users = await listUsers(env.DB, "pending");
  if (!users.length) {
    await sendMessage(env, chatId, "کاربر در انتظاری وجود ندارد.", adminKeyboard());
    return;
  }
  for (const user of users.slice(0, 10)) {
    await sendMessage(env, chatId, `کاربر ${user.username} در انتظار تأیید است.`, {
      inline_keyboard: [
        [{ text: "تأیید", callback_data: `ua:${user.id}` }],
        [{ text: "بلاک", callback_data: `ub:${user.id}` }],
      ],
    });
  }
}

async function listAdminNews(env, chatId) {
  const articles = await listArticles(env.DB, 6, 0, 0);
  if (!articles.length) {
    await sendMessage(env, chatId, "خبری برای مدیریت وجود ندارد.", adminKeyboard());
    return;
  }
  for (const article of articles) {
    await sendMessage(env, chatId, `${article.title}\n${article.source}`, {
      inline_keyboard: [
        [
          { text: "آرشیو", callback_data: `aa:${article.id}` },
          { text: "حذف", callback_data: `ad:${article.id}` },
        ],
        [{ text: "مشاهده", url: `${env.SITE_URL || "https://example.com"}/news/${article.id}` }],
      ],
    });
  }
}

async function handleCallback(env, update) {
  const callback = update.callback_query;
  const chatId = callback.message?.chat?.id;
  const data = callback.data || "";
  await call(env, "answerCallbackQuery", { callback_query_id: callback.id });
  if (!chatId) return;

  const user = await getUserByChatId(env.DB, chatId);
  if (!user || user.status !== "active") {
    await sendMessage(env, chatId, "حساب تلگرام شما به سایت متصل نیست یا فعال نیست.");
    return;
  }

  if (data === "profile") return showProfile(env, user);
  if (data === "news") {
    const text = await showNews(env);
    return sendMessage(env, chatId, text, mainKeyboard(env, user.role === "admin"));
  }
  if (data === "notify") {
    if (!user.notify_allowed) {
      return sendMessage(env, chatId, "اجازه دریافت اعلان برای شما غیرفعال است. با ادمین تماس بگیرید.");
    }
    const enabled = !user.notify_enabled;
    await env.DB.prepare("UPDATE users SET notify_enabled = ? WHERE id = ?")
      .bind(enabled ? 1 : 0, user.id)
      .run();
    return sendMessage(env, chatId, `اعلان‌ها ${enabled ? "روشن" : "خاموش"} شد.`, mainKeyboard(env, user.role === "admin"));
  }

  if (user.role !== "admin") {
    return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
  }

  if (data === "admin") {
    const pendingComments = await countComments(env.DB, "pending");
    const pendingUsers = await countUsers(env.DB, "pending");
    return sendMessage(
      env,
      chatId,
      `پنل مدیریت\nنظرهای در انتظار: ${pendingComments}\nکاربران در انتظار: ${pendingUsers}`,
      adminKeyboard()
    );
  }
  if (data === "admc") return listPendingComments(env, chatId);
  if (data === "admu") return listPendingUsers(env, chatId);
  if (data === "admnews") return listAdminNews(env, chatId);

  const [action, rawId] = data.split(":");
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return;

  if (action === "aa") {
    await setArticleArchived(env.DB, id, 1);
    return sendMessage(env, chatId, `خبر #${id} به آرشیو منتقل شد.`, adminKeyboard());
  }
  if (action === "ad") {
    await deleteArticleRow(env.DB, id);
    return sendMessage(env, chatId, `خبر #${id} و نظرهای آن حذف شد.`, adminKeyboard());
  }

  if (action === "ca") {
    await setCommentStatus(env.DB, id, "approved", user.id);
    return sendMessage(env, chatId, `نظر #${id} تأیید شد.`, adminKeyboard());
  }
  if (action === "cr") {
    await setCommentStatus(env.DB, id, "rejected", user.id);
    return sendMessage(env, chatId, `نظر #${id} رد شد.`, adminKeyboard());
  }
  if (action === "dl") {
    await deleteCommentRow(env.DB, id);
    return sendMessage(env, chatId, `نظر #${id} حذف شد.`, adminKeyboard());
  }
  if (action === "rp") {
    await setBotState(env.DB, chatId, "reply", id);
    return sendMessage(env, chatId, `پاسخ به نظر #${id} را بنویسید.`);
  }
  if (action === "ua") {
    await setUserStatus(env.DB, id, "active", user.id);
    return sendMessage(env, chatId, `کاربر #${id} تأیید شد.`, adminKeyboard());
  }
  if (action === "ub") {
    await setUserStatus(env.DB, id, "blocked", user.id);
    return sendMessage(env, chatId, `کاربر #${id} بلاک شد.`, adminKeyboard());
  }
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
        "حساب تلگرام شما با موفقیت به مهران‌نیوز متصل شد.",
        mainKeyboard(env, user?.role === "admin")
      );
      return;
    }
    if (user) {
      await sendMessage(env, chatId, "منوی مهران‌نیوز", mainKeyboard(env, user.role === "admin"));
      return;
    }
    await sendMessage(
      env,
      chatId,
      "برای اتصال، وارد پنل کاربری سایت شوید و دکمه «اتصال به تلگرام» را بزنید.",
      mainKeyboard(env, false)
    );
    return;
  }

  if (message.contact && user) {
    const phone = message.contact.phone_number;
    if (phone) {
      await setUserPhone(env.DB, user.id, phone);
      await sendMessage(env, chatId, "شماره موبایل شما ذخیره شد.");
    }
    return;
  }

  if (!user) {
    await sendMessage(env, chatId, "ابتدا حساب تلگرام خود را از پنل کاربری سایت متصل کنید.");
    return;
  }

  const state = await getBotState(env.DB, chatId);
  if (state?.action === "reply" && state.comment_id && text) {
    if (user.role !== "admin") {
      await clearBotState(env.DB, chatId);
      return sendMessage(env, chatId, "شما دسترسی مدیریتی ندارید.");
    }
    await replyToComment(env.DB, state.comment_id, text.slice(0, 800), user.id);
    await clearBotState(env.DB, chatId);
    const comment = await getComment(env.DB, state.comment_id);
    await notifyReply(env, comment);
    await sendMessage(env, chatId, `پاسخ ثبت شد و نظر #${state.comment_id} تأیید شد.`, adminKeyboard());
    return;
  }

  if (text === "/menu" || text === "منو") {
    return sendMessage(env, chatId, "منوی مهران‌نیوز", mainKeyboard(env, user.role === "admin"));
  }

  await sendMessage(env, chatId, "برای ادامه از دکمه‌های منو استفاده کنید.", mainKeyboard(env, user.role === "admin"));
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
