import {
  clearLoginAttempts,
  clearUserTelegram,
  countComments,
  countUnreadMessages,
  countUsers,
  createComment,
  createLinkToken,
  createMessage,
  createUser,
  deleteArticleRow,
  deleteCommentRow,
  deleteMessageRow,
  ensureSchema,
  getArticle,
  getComment,
  getMeta,
  getStats,
  getUserByUsername,
  isRateLimited,
  listAdminChats,
  listApprovedComments,
  listArticles,
  listArticlesPage,
  listCommentsForAdmin,
  listMessages,
  listUsers,
  markMessageRead,
  normalizeSort,
  recordLoginAttempt,
  replyToComment,
  saveArticles,
  setArticleArchived,
  setCommentStatus,
  setUserNotifyAllowed,
  setUserNotifyEnabled,
  setUserRole,
  setUserStatus,
  toggleLike,
} from "./db.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  isSameOrigin,
  makePassword,
  clientKey,
  randomToken,
  sessionCookie,
  verifyPassword,
} from "./auth.js";
import { fetchAll } from "./feeds.js";
import { checkComment, containsProfanity } from "./moderation.js";
import {
  botConfigured,
  handleTelegramWebhook,
  notifyAdminsNewComment,
  notifyAdminsNewUser,
  notifyNewArticles,
  notifyReply,
  sendMessage,
} from "./telegram.js";
import {
  adminCommentsPage,
  adminMessagesPage,
  adminNewsPage,
  adminOverviewPage,
  adminUsersPage,
  articlePage,
  errorPage,
  flashFor,
  homePage,
  loginPage,
  panelPage,
  registerPage,
} from "./views.js";
import { CSS } from "./style.js";

const REFRESH_MIN_INTERVAL_MS = 2 * 60 * 1000;
const HOME_PAGE_SIZE = 10;
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,30}$/u;

let refreshInFlight = null;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { Location: location, ...headers } });
}

function notFound(user) {
  return htmlResponse(errorPage({ user, title: "یافت نشد", message: "صفحه‌ای که خواستید وجود ندارد." }), 404);
}

function forbidden(user) {
  return htmlResponse(
    errorPage({ user, title: "دسترسی ندارید", message: "این بخش فقط برای ادمین است." }),
    403
  );
}

function safeNext(value) {
  return value && /^\/(?!\/)/.test(value) && !value.startsWith("/logout") ? value : "";
}

function backTo(request, fallback) {
  const referer = request.headers.get("Referer");
  if (!referer) return fallback;
  try {
    const parsed = new URL(referer);
    const target = new URL(request.url);
    if (parsed.host !== target.host) return fallback;
    const path = `${parsed.pathname}${parsed.search}`;
    return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
  } catch {
    return fallback;
  }
}

async function refreshNews(env) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    await ensureSchema(env.DB, env);
    const last = await getMeta(env.DB, "last_fetch");
    if (last && Date.now() - new Date(last).getTime() < REFRESH_MIN_INTERVAL_MS) {
      return { fetched: 0, inserted: 0, skipped: true, articles: [] };
    }

    const { articles, feedsOk } = await fetchAll(env);
    if (feedsOk === 0) throw new Error("all news feeds failed");

    const fetchedAt = new Date().toISOString();
    const inserted = await saveArticles(env.DB, articles, fetchedAt);
    return { fetched: articles.length, inserted: inserted.length, skipped: false, articles: inserted };
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function handleRefresh(request, env, url, ctx) {
  let result = "0";
  try {
    const outcome = await refreshNews(env);
    if (outcome.skipped) result = "rate";
    else if (outcome.inserted > 0) result = "1";
    if (outcome.articles?.length) {
      ctx.waitUntil(
        notifyNewArticles(env, outcome.articles).catch((error) =>
          console.error("telegram push failed:", error)
        )
      );
    }
  } catch (error) {
    console.error("refresh failed:", error);
    result = "error";
  }
  return redirect(`/?refreshed=${result}`);
}

async function handleLogin(request, env, url) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const next = safeNext(String(form.get("next") || ""));
  const key = `${clientKey(request)}|${username.toLowerCase()}`;

  if (!username || !password) return redirect(loginRedirect("bad_login", next));

  if (await isRateLimited(env.DB, key)) return redirect(loginRedirect("rate", next));

  const row = await getUserByUsername(env.DB, username);
  const valid = row ? await verifyPassword(password, row.salt, row.password_hash) : false;
  if (!valid) {
    await recordLoginAttempt(env.DB, key);
    return redirect(loginRedirect("bad_login", next));
  }

  if (row.status === "pending") return redirect(loginRedirect("pending", next));
  if (row.status === "blocked") return redirect(loginRedirect("blocked", next));
  if (row.status !== "active") return redirect(loginRedirect("bad_login", next));

  await clearLoginAttempts(env.DB, key);
  const token = await createSession(env.DB, row.id);
  const destination = next || (row.role === "admin" ? "/admin" : "/panel");
  return redirect(destination, {
    "Set-Cookie": sessionCookie(token, url.protocol === "https:"),
  });
}

function loginRedirect(message, next) {
  const params = new URLSearchParams({ msg: message });
  if (next) params.set("next", next);
  return `/login?${params}`;
}

async function handleRegister(request, env, ctx) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");

  if (!USERNAME_RE.test(username)) return redirect("/register?msg=invalid_username");
  if (password.length < 6 || password.length > 100) return redirect("/register?msg=weak");
  if (await getUserByUsername(env.DB, username)) return redirect("/register?msg=duplicate");

  const { salt, hash } = await makePassword(password);
  await createUser(env.DB, { username, hash, salt, role: "user", status: "pending" });
  ctx.waitUntil(
    notifyAdminsNewUser(env, username).catch((error) =>
      console.error("new user alert failed:", error)
    )
  );
  return redirect("/login?msg=registered");
}

async function handlePanelAction(request, env, user, url, ctx) {
  const { pathname } = url;

  if (pathname === "/panel/notify") {
    const form = await request.formData();
    const enabled = form.get("enabled") === "1";
    if (!user.notify_allowed) return redirect("/panel?msg=notify_saved");
    await setUserNotifyEnabled(env.DB, user.id, enabled);
    return redirect("/panel?msg=notify_saved");
  }

  if (pathname === "/panel/message") {
    const form = await request.formData();
    const body = String(form.get("body") || "").trim().slice(0, 2000);
    if (containsProfanity(body)) return redirect("/panel?msg=message_profanity");
    if (body) {
      await createMessage(env.DB, user.id, body);
      const admins = await listAdminChats(env.DB);
      if (admins.length) {
        ctx.waitUntil(
          Promise.allSettled(
            admins.map((admin) =>
              sendMessage(env, admin.telegram_chat_id, `پیام تازه از ${user.username}:\n\n${body}`)
            )
          )
        );
      }
    }
    return redirect("/panel?msg=message_sent");
  }

  if (pathname === "/panel/telegram/link") {
    const token = randomToken(18);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await createLinkToken(env.DB, user.id, token, expiresAt);
    return redirect(`/panel?token=${encodeURIComponent(token)}`);
  }

  if (pathname === "/panel/telegram/unlink") {
    await clearUserTelegram(env.DB, user.id);
    return redirect("/panel?msg=telegram_unlinked");
  }

  return notFound(user);
}

async function handleAdminAction(request, env, user, url, ctx) {
  const { pathname } = url;

  let match = pathname.match(/^\/admin\/news\/(\d+)\/(archive|delete)$/);
  if (match) {
    const id = Number(match[1]);
    if (match[2] === "archive") {
      await setArticleArchived(env.DB, id, 1);
      return redirect("/admin/news?msg=article_archived");
    }
    await deleteArticleRow(env.DB, id);
    const back = backTo(request, "/admin/news");
    return redirect(`${back}${back.includes("?") ? "&" : "?"}msg=article_deleted`);
  }

  match = pathname.match(/^\/admin\/archive\/(\d+)\/restore$/);
  if (match) {
    await setArticleArchived(env.DB, Number(match[1]), 0);
    return redirect("/admin/archive?msg=article_restored");
  }

  match = pathname.match(/^\/admin\/users\/(\d+)\/(approve|block|unblock|promote|notify-on|notify-off)$/);
  if (match) {
    const id = Number(match[1]);
    const action = match[2];
    if (action === "approve") {
      await setUserStatus(env.DB, id, "active", user.id);
      return redirect("/admin/users?msg=user_approved");
    }
    if (action === "block") {
      if (id === user.id) return redirect("/admin/users");
      await setUserStatus(env.DB, id, "blocked", user.id);
      return redirect("/admin/users?msg=user_blocked");
    }
    if (action === "unblock") {
      await setUserStatus(env.DB, id, "active", user.id);
      return redirect("/admin/users?msg=user_unblocked");
    }
    if (action === "promote") {
      await setUserRole(env.DB, id, "admin");
      return redirect("/admin/users?msg=user_promoted");
    }
    await setUserNotifyAllowed(env.DB, id, action === "notify-on");
    return redirect(`/admin/users?msg=${action === "notify-on" ? "notify_on" : "notify_off"}`);
  }

  if (pathname === "/admin/users/create-admin") {
    const form = await request.formData();
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    if (!USERNAME_RE.test(username) || password.length < 6) {
      return redirect("/admin/users?msg=weak");
    }
    if (await getUserByUsername(env.DB, username)) {
      return redirect("/admin/users?msg=duplicate");
    }
    const { salt, hash } = await makePassword(password);
    await createUser(env.DB, { username, hash, salt, role: "admin", status: "active" });
    return redirect("/admin/users?msg=admin_created");
  }

  match = pathname.match(/^\/admin\/comments\/(\d+)\/(approve|reject|delete|reply)$/);
  if (match) {
    const id = Number(match[1]);
    if (match[2] === "approve") {
      await setCommentStatus(env.DB, id, "approved", user.id);
      return redirect("/admin/comments?status=pending&msg=comment_approved");
    }
    if (match[2] === "reject") {
      await setCommentStatus(env.DB, id, "rejected", user.id);
      return redirect("/admin/comments?status=pending&msg=comment_rejected");
    }
    if (match[2] === "delete") {
      await deleteCommentRow(env.DB, id);
      return redirect(backTo(request, "/admin/comments"));
    }
    const form = await request.formData();
    const reply = String(form.get("reply") || "").trim();
    if (!reply) return redirect("/admin/comments?status=approved");
    await replyToComment(env.DB, id, reply.slice(0, 800), user.id);
    const comment = await getComment(env.DB, id);
    if (comment) {
      ctx.waitUntil(
        notifyReply(env, comment).catch((error) => console.error("reply notify failed:", error))
      );
    }
    return redirect("/admin/comments?status=approved&msg=comment_replied");
  }

  match = pathname.match(/^\/admin\/messages\/(\d+)\/(read|delete)$/);
  if (match) {
    const id = Number(match[1]);
    if (match[2] === "read") {
      await markMessageRead(env.DB, id);
      return redirect("/admin/messages");
    }
    await deleteMessageRow(env.DB, id);
    return redirect("/admin/messages");
  }

  return notFound(user);
}

async function renderAdminComments(env, user, url) {
  const status = url.searchParams.get("status") === "approved" ? "approved" : "pending";
  const comments = await listCommentsForAdmin(env.DB, status);
  return adminCommentsPage({ user, flash: flashFor(url), comments, status });
}

async function handleAdminPage(env, user, url) {
  const { pathname } = url;

  if (pathname === "/admin") {
    const [stats, pendingComments, pendingUsers, users, unreadMessages] = await Promise.all([
      getStats(env.DB),
      countComments(env.DB, "pending"),
      countUsers(env.DB, "pending"),
      countUsers(env.DB),
      countUnreadMessages(env.DB),
    ]);
    return adminOverviewPage({
      user,
      flash: flashFor(url),
      stats: { ...stats, pendingComments, pendingUsers, users, unreadMessages },
    });
  }

  if (pathname === "/admin/news" || pathname === "/admin/archive") {
    const archived = pathname === "/admin/archive";
    const articles = await listArticles(env.DB, 300, 0, archived ? 1 : 0);
    return adminNewsPage({ user, flash: flashFor(url), articles, archived });
  }

  if (pathname === "/admin/users") {
    const entries = await listUsers(env.DB);
    return adminUsersPage({ user, flash: flashFor(url), entries });
  }

  if (pathname === "/admin/messages") {
    const messages = await listMessages(env.DB);
    return adminMessagesPage({ user, flash: flashFor(url), messages });
  }

  if (pathname === "/admin/comments") return renderAdminComments(env, user, url);

  return null;
}

async function handleArticle(request, env, url, user, ctx) {
  const likeMatch = url.pathname.match(/^\/news\/(\d+)\/like$/);
  const commentMatch = url.pathname.match(/^\/news\/(\d+)\/comment$/);

  if (likeMatch) {
    const id = Number(likeMatch[1]);
    const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
    if (!user) {
      if (wantsJson) return jsonResponse({ error: "login_required" }, 401);
      return redirect(`/login?msg=login_required&next=${encodeURIComponent(`/news/${id}`)}`);
    }
    const article = await getArticle(env.DB, id, user.id);
    if (!article) return wantsJson ? jsonResponse({ error: "not_found" }, 404) : notFound(user);
    const result = await toggleLike(env.DB, user.id, article.id);
    if (wantsJson) return jsonResponse(result);
    return redirect(backTo(request, `/news/${article.id}`));
  }

  if (commentMatch) {
    const id = Number(commentMatch[1]);
    if (!user) return redirect(`/login?msg=login_required&next=${encodeURIComponent(`/news/${id}`)}`);
    const article = await getArticle(env.DB, id, user.id);
    if (!article) return notFound(user);
    const form = await request.formData();
    const result = checkComment(form.get("body"));
    if (!result.ok) {
      return redirect(`/news/${article.id}?msg=profanity#comments`);
    }
    const status = user.role === "admin" ? "approved" : "pending";
    const commentId = await createComment(env.DB, {
      articleId: article.id,
      userId: user.id,
      body: result.body,
      status,
    });
    if (user.role !== "admin") {
      ctx.waitUntil(
        getComment(env.DB, commentId)
          .then((comment) => comment && notifyAdminsNewComment(env, comment))
          .catch((error) => console.error("comment alert failed:", error))
      );
    }
    return redirect(`/news/${article.id}?msg=${status === "approved" ? "comment_posted" : "comment_pending"}#comments`);
  }

  return null;
}

async function renderArticle(env, url, user) {
  const match = url.pathname.match(/^\/news\/(\d+)$/);
  if (!match) return null;
  const article = await getArticle(env.DB, Number(match[1]), user?.id || 0);
  if (!article || (article.archived && user?.role !== "admin")) return { status: 404 };
  const comments = await listApprovedComments(env.DB, article.id);
  return {
    html: articlePage({ user, article, comments, flash: flashFor(url), now: new Date() }),
  };
}

export default {
  async fetch(request, env, ctx) {
    try {
      await ensureSchema(env.DB, env);
      const url = new URL(request.url);
      const { pathname } = url;
      const user = await getSessionUser(request, env.DB);
      const isPost = request.method === "POST";

      if (isPost && pathname !== "/telegram/webhook" && !isSameOrigin(request)) {
        return new Response("Forbidden", { status: 403 });
      }

      if (pathname === "/telegram/webhook" && isPost) {
        return handleTelegramWebhook(request, env);
      }

      if (pathname === "/" && request.method === "GET") {
        const sort = normalizeSort(url.searchParams.get("sort") || "newest");
        const stats = await getStats(env.DB);
        const totalPages = Math.max(1, Math.ceil(stats.count / HOME_PAGE_SIZE));
        const requested = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const page = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), totalPages);
        const rows = await listArticlesPage(env.DB, {
          limit: HOME_PAGE_SIZE,
          offset: (page - 1) * HOME_PAGE_SIZE,
          viewerId: user?.id || 0,
          sort,
        });
        return htmlResponse(
          homePage({
            user,
            rows,
            stats,
            flash: flashFor(url),
            now: new Date(),
            sort,
            page,
            totalPages,
          })
        );
      }

      if (pathname === "/login" && request.method === "GET") {
        return htmlResponse(
          loginPage({ user, flash: flashFor(url), next: safeNext(url.searchParams.get("next") || "") })
        );
      }
      if (pathname === "/login" && isPost) return handleLogin(request, env, url);

      if (pathname === "/register" && request.method === "GET") {
        return htmlResponse(registerPage({ user, flash: flashFor(url) }));
      }
      if (pathname === "/register" && isPost) return handleRegister(request, env, ctx);

      if (pathname === "/logout" && isPost) {
        await destroySession(request, env.DB);
        return redirect("/", {
          "Set-Cookie": clearSessionCookie(url.protocol === "https:"),
        });
      }

      if (pathname === "/panel") {
        if (!user) return redirect("/login?msg=login_required&next=%2Fpanel");
        if (request.method !== "GET") {
          return handlePanelAction(request, env, user, url, ctx);
        }
        return htmlResponse(
          panelPage({
            user,
            flash: flashFor(url),
            linkToken: url.searchParams.get("token") || "",
            botUsername: env.TELEGRAM_BOT_USERNAME || "",
          })
        );
      }
      if (pathname.startsWith("/panel/") && isPost) {
        if (!user) return redirect("/login?msg=login_required&next=%2Fpanel");
        return handlePanelAction(request, env, user, url, ctx);
      }

      const articleResult = await renderArticle(env, url, user);
      if (articleResult) {
        if (articleResult.status === 404) return notFound(user);
        return htmlResponse(articleResult.html);
      }

      const articleAction = isPost ? await handleArticle(request, env, url, user, ctx) : null;
      if (articleAction) return articleAction;

      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        if (!user) return redirect("/login?msg=login_required&next=%2Fadmin");
        if (user.role !== "admin") return forbidden(user);
        if (isPost) return handleAdminAction(request, env, user, url, ctx);
        const html = await handleAdminPage(env, user, url);
        if (html) return htmlResponse(html);
        return notFound(user);
      }

      if (pathname === "/refresh" && isPost) {
        if (!user || user.role !== "admin") return forbidden(user);
        return handleRefresh(request, env, url, ctx);
      }

      if (pathname === "/api/news" && request.method === "GET") {
        const [articles, stats] = await Promise.all([
          listArticles(env.DB, 300, 0, 0),
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
        return new Response(JSON.stringify({ ok: true, bot: botConfigured(env) }), {
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

      if (pathname === "/favicon.ico") return new Response(null, { status: 204 });

      return notFound(user);
    } catch (error) {
      console.error("worker error:", error);
      return htmlResponse(
        errorPage({
          user: null,
          title: "خطای سرور",
          message: "مشکلی پیش آمد. چند لحظه بعد دوباره تلاش کنید.",
        }),
        500
      );
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      refreshNews(env)
        .then((outcome) => {
          if (outcome.articles?.length) return notifyNewArticles(env, outcome.articles);
          return null;
        })
        .catch((error) => console.error("scheduled refresh failed:", error))
    );
  },
};
