import { makePassword } from "./auth.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url ON articles (url)",
  "CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC)",
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    telegram_chat_id TEXT,
    telegram_username TEXT,
    phone TEXT,
    notify_enabled INTEGER NOT NULL DEFAULT 0,
    notify_allowed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    approved_at TEXT,
    approved_by INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)",
  "CREATE INDEX IF NOT EXISTS idx_users_chat ON users (telegram_chat_id)",
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)",
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_reply TEXT,
    admin_reply_at TEXT,
    created_at TEXT NOT NULL,
    moderated_at TEXT,
    moderated_by INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS idx_comments_article ON comments (article_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status)",
  `CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, article_id)
  )`,
  `CREATE TABLE IF NOT EXISTS link_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bot_state (
    chat_id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    comment_id INTEGER,
    message_id INTEGER,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at DESC)",
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    day TEXT PRIMARY KEY,
    views INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS forum_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS forum_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_forum_threads_board ON forum_threads (board_id, pinned DESC, updated_at DESC)",
  `CREATE TABLE IF NOT EXISTS forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    quote_post_id INTEGER,
    created_at TEXT NOT NULL,
    edited_at TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts (thread_id, created_at)",
  `CREATE TABLE IF NOT EXISTS forum_likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  )`,
];

let schemaReady = false;

export async function ensureSchema(db, env) {
  if (!schemaReady) {
    for (const statement of SCHEMA) {
      await db.prepare(statement).run();
    }
    const columns = await db.prepare("PRAGMA table_info(articles)").all();
    if (!columns.results.some((column) => column.name === "archived")) {
      await db.prepare("ALTER TABLE articles ADD COLUMN archived INTEGER NOT NULL DEFAULT 0").run();
    }
    const botColumns = await db.prepare("PRAGMA table_info(bot_state)").all();
    if (!botColumns.results.some((column) => column.name === "message_id")) {
      await db.prepare("ALTER TABLE bot_state ADD COLUMN message_id INTEGER").run();
    }
    schemaReady = true;
  }
  await seedAdmin(db, env);
  await seedForumBoards(db);
}

const FORUM_BOARDS = [
  ["گفت‌وگوی عمومی", "بحث آزاد درباره مهران مدیری، آثار و خاطره‌ها"],
  ["اخبار و حاشیه‌ها", "گفت‌وگو درباره خبرهای تازه و حاشیه‌های پیرامون آن‌ها"],
  ["پیشنهاد و انتقاد", "ایده‌ها، پیشنهادها و انتقادهای کاربران درباره سایت و فروم"],
];

async function seedForumBoards(db) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM forum_boards").first();
  if (row?.count) return;
  const now = new Date().toISOString();
  for (let index = 0; index < FORUM_BOARDS.length; index += 1) {
    const [title, description] = FORUM_BOARDS[index];
    await db
      .prepare(
        "INSERT INTO forum_boards (title, description, sort_order, created_at) VALUES (?, ?, ?, ?)"
      )
      .bind(title, description, index + 1, now)
      .run();
  }
}

async function seedAdmin(db, env) {
  const username = env?.ADMIN_USERNAME;
  if (!username || !env?.ADMIN_PASSWORD) return;
  const seeded = await getMeta(db, "admin_seeded");
  if (seeded) return;
  const existing = await getUserByUsername(db, username);
  if (!existing) {
    const { salt, hash } = await makePassword(env.ADMIN_PASSWORD);
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO users (username, password_hash, salt, role, status, created_at, approved_at)
         VALUES (?, ?, ?, 'admin', 'active', ?, ?)`
      )
      .bind(username, hash, salt, now, now)
      .run();
  }
  await setMeta(db, "admin_seeded", "1");
}

export async function getMeta(db, key) {
  const row = await db.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

export async function setMeta(db, key, value) {
  await db
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key, value)
    .run();
}

export async function saveArticles(db, articles, fetchedAt) {
  const statements = articles.map((article) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO articles
          (title, url, source, summary, image_url, published_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        article.title,
        article.url,
        article.source,
        article.summary,
        article.image_url,
        article.published_at,
        fetchedAt
      )
  );
  statements.push(
    db
      .prepare(
        `INSERT INTO meta (key, value) VALUES ('last_fetch', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .bind(fetchedAt)
  );

  const results = await db.batch(statements);
  const inserted = [];
  for (let index = 0; index < articles.length; index += 1) {
    if (results[index].meta?.changes) {
      inserted.push({ ...articles[index], id: results[index].meta.last_row_id });
    }
  }
  return inserted;
}

const ARTICLE_COLUMNS = `
  a.id, a.title, a.url, a.source, a.summary, a.image_url, a.published_at, a.fetched_at,
  a.archived,
  (SELECT COUNT(*) FROM likes l WHERE l.article_id = a.id) AS like_count,
  (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id AND c.status = 'approved') AS comment_count,
  EXISTS (SELECT 1 FROM likes l2 WHERE l2.article_id = a.id AND l2.user_id = ?) AS liked`;

const ARTICLE_SORTS = {
  newest: "COALESCE(a.published_at, a.fetched_at) DESC, a.id DESC",
  popular: "like_count DESC, comment_count DESC, COALESCE(a.published_at, a.fetched_at) DESC",
  comments: "comment_count DESC, like_count DESC, COALESCE(a.published_at, a.fetched_at) DESC",
};

export function normalizeSort(value) {
  return Object.hasOwn(ARTICLE_SORTS, value) ? value : "newest";
}

export async function listArticles(db, limit = 300, viewerId = 0, archived = 0) {
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS}
       FROM articles a
       WHERE a.archived = ?
       ORDER BY COALESCE(a.published_at, a.fetched_at) DESC
       LIMIT ?`
    )
    .bind(viewerId, archived, limit)
    .all();
  return results;
}

export async function listArticlesPage(
  db,
  { limit = 20, offset = 0, viewerId = 0, archived = 0, sort = "newest" } = {}
) {
  const order = ARTICLE_SORTS[normalizeSort(sort)];
  const { results } = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS}
       FROM articles a
       WHERE a.archived = ?
       ORDER BY ${order}
       LIMIT ? OFFSET ?`
    )
    .bind(viewerId, archived, limit, offset)
    .all();
  return results;
}

export async function countArticles(db, archived = 0) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM articles WHERE archived = ?")
    .bind(archived)
    .first();
  return row?.count || 0;
}

export async function getArticle(db, id, viewerId = 0) {
  return db
    .prepare(`SELECT ${ARTICLE_COLUMNS} FROM articles a WHERE a.id = ?`)
    .bind(viewerId, id)
    .first();
}

export async function getStats(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, COUNT(DISTINCT source) AS sources
       FROM articles WHERE archived = 0`
    )
    .first();
  const archived = await db
    .prepare("SELECT COUNT(*) AS count FROM articles WHERE archived = 1")
    .first();
  const last = await db
    .prepare("SELECT value FROM meta WHERE key = 'last_fetch'")
    .first();
  return {
    count: row?.count || 0,
    sources: row?.sources || 0,
    archived: archived?.count || 0,
    lastFetch: last?.value || null,
  };
}

export async function recordVisit(db, day) {
  await db
    .prepare(
      `INSERT INTO visits (day, views) VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET views = views + 1`
    )
    .bind(day)
    .run();
}

export async function listVisitsSince(db, day) {
  const { results } = await db
    .prepare("SELECT day, views FROM visits WHERE day >= ? ORDER BY day ASC")
    .bind(day)
    .all();
  return results;
}

export async function deleteArticleRow(db, id) {
  await db.batch([
    db.prepare("DELETE FROM likes WHERE article_id = ?").bind(id),
    db.prepare("DELETE FROM comments WHERE article_id = ?").bind(id),
    db.prepare("DELETE FROM articles WHERE id = ?").bind(id),
  ]);
}

export async function setArticleArchived(db, id, archived) {
  await db.prepare("UPDATE articles SET archived = ? WHERE id = ?").bind(archived, id).run();
}

export async function getUserById(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
}

export async function getUserByUsername(db, username) {
  return db
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .bind(username)
    .first();
}

export async function getUserByChatId(db, chatId) {
  return db
    .prepare("SELECT * FROM users WHERE telegram_chat_id = ?")
    .bind(String(chatId))
    .first();
}

export async function createUser(db, { username, hash, salt, role = "user", status = "pending" }) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO users (username, password_hash, salt, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(username, hash, salt, role, status, now)
    .run();
  return result.meta.last_row_id;
}

export async function listUsers(db, status = null) {
  const query = status
    ? "SELECT * FROM users WHERE status = ? ORDER BY created_at DESC"
    : "SELECT * FROM users ORDER BY created_at DESC";
  const statement = status ? db.prepare(query).bind(status) : db.prepare(query);
  const { results } = await statement.all();
  return results;
}

export async function countUsers(db, status) {
  const row = status
    ? await db.prepare("SELECT COUNT(*) AS count FROM users WHERE status = ?").bind(status).first()
    : await db.prepare("SELECT COUNT(*) AS count FROM users").first();
  return row?.count || 0;
}

export async function setUserStatus(db, id, status, approvedBy) {
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE users SET status = ?, approved_at = CASE WHEN ? = 'active' THEN ? ELSE approved_at END, approved_by = ? WHERE id = ?"
    )
    .bind(status, status, now, approvedBy, id)
    .run();
}

export async function setUserRole(db, id, role) {
  await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
}

export async function setUserNotifyAllowed(db, id, allowed) {
  await db.prepare("UPDATE users SET notify_allowed = ? WHERE id = ?").bind(allowed ? 1 : 0, id).run();
}

export async function setUserNotifyEnabled(db, id, enabled) {
  await db
    .prepare("UPDATE users SET notify_enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, id)
    .run();
}

export async function setUserTelegram(db, id, chatId, username) {
  await db
    .prepare("UPDATE users SET telegram_chat_id = ?, telegram_username = ? WHERE id = ?")
    .bind(String(chatId), username || null, id)
    .run();
}

export async function clearUserTelegram(db, id) {
  await db
    .prepare(
      "UPDATE users SET telegram_chat_id = NULL, telegram_username = NULL, notify_enabled = 0 WHERE id = ?"
    )
    .bind(id)
    .run();
}

export async function listNotifyTargets(db) {
  const { results } = await db
    .prepare(
      `SELECT id, username, telegram_chat_id
       FROM users
       WHERE status = 'active' AND notify_enabled = 1 AND notify_allowed = 1
         AND telegram_chat_id IS NOT NULL`
    )
    .all();
  return results;
}

export async function listAdminChats(db) {
  const { results } = await db
    .prepare(
      `SELECT id, username, telegram_chat_id
       FROM users
       WHERE role = 'admin' AND status = 'active' AND telegram_chat_id IS NOT NULL`
    )
    .all();
  return results;
}

export async function createMessage(db, userId, body) {
  const result = await db
    .prepare("INSERT INTO messages (user_id, body, created_at) VALUES (?, ?, ?)")
    .bind(userId, body, new Date().toISOString())
    .run();
  return result.meta.last_row_id;
}

export async function listMessages(db, limit = 100) {
  const { results } = await db
    .prepare(
      `SELECT m.*, u.username
       FROM messages m JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results;
}

export async function countUnreadMessages(db) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM messages WHERE read_at IS NULL").first();
  return row?.count || 0;
}

export async function markMessageRead(db, id) {
  await db
    .prepare("UPDATE messages SET read_at = COALESCE(read_at, ?) WHERE id = ?")
    .bind(new Date().toISOString(), id)
    .run();
}

export async function deleteMessageRow(db, id) {
  await db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
}

export async function createLinkToken(db, userId, token, expiresAt) {
  await db.batch([
    db.prepare("DELETE FROM link_tokens WHERE user_id = ?").bind(userId),
    db
      .prepare("INSERT INTO link_tokens (token, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(token, userId, expiresAt),
  ]);
}

export async function consumeLinkToken(db, token) {
  const row = await db.prepare("SELECT * FROM link_tokens WHERE token = ?").bind(token).first();
  if (!row) return null;
  await db.prepare("DELETE FROM link_tokens WHERE token = ?").bind(token).run();
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.user_id;
}

export async function createComment(db, { articleId, userId, body, status }) {
  const result = await db
    .prepare(
      "INSERT INTO comments (article_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(articleId, userId, body, status, new Date().toISOString())
    .run();
  return result.meta.last_row_id;
}

export async function listApprovedComments(db, articleId) {
  const { results } = await db
    .prepare(
      `SELECT c.*, u.username
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.article_id = ? AND c.status = 'approved'
       ORDER BY c.created_at ASC`
    )
    .bind(articleId)
    .all();
  return results;
}

export async function listCommentsForAdmin(db, status = "pending") {
  const { results } = await db
    .prepare(
      `SELECT c.*, u.username, a.title AS article_title
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN articles a ON a.id = c.article_id
       WHERE c.status = ?
       ORDER BY c.created_at DESC
       LIMIT 200`
    )
    .bind(status)
    .all();
  return results;
}

export async function getComment(db, id) {
  return db
    .prepare(
      `SELECT c.*, u.username, u.telegram_chat_id, u.notify_enabled, u.notify_allowed,
              a.title AS article_title, a.url AS article_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN articles a ON a.id = c.article_id
       WHERE c.id = ?`
    )
    .bind(id)
    .first();
}

export async function setCommentStatus(db, id, status, moderatedBy) {
  await db
    .prepare("UPDATE comments SET status = ?, moderated_at = ?, moderated_by = ? WHERE id = ?")
    .bind(status, new Date().toISOString(), moderatedBy, id)
    .run();
}

export async function replyToComment(db, id, reply, moderatedBy) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE comments
       SET admin_reply = ?, admin_reply_at = ?, status = 'approved', moderated_at = ?, moderated_by = ?
       WHERE id = ?`
    )
    .bind(reply, now, now, moderatedBy, id)
    .run();
}

export async function deleteCommentRow(db, id) {
  await db.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
}

export async function countComments(db, status) {
  const row = status
    ? await db.prepare("SELECT COUNT(*) AS count FROM comments WHERE status = ?").bind(status).first()
    : await db.prepare("SELECT COUNT(*) AS count FROM comments").first();
  return row?.count || 0;
}

export async function toggleLike(db, userId, articleId) {
  const existing = await db
    .prepare("SELECT 1 AS found FROM likes WHERE user_id = ? AND article_id = ?")
    .bind(userId, articleId)
    .first();
  if (existing) {
    await db
      .prepare("DELETE FROM likes WHERE user_id = ? AND article_id = ?")
      .bind(userId, articleId)
      .run();
  } else {
    await db
      .prepare("INSERT INTO likes (user_id, article_id, created_at) VALUES (?, ?, ?)")
      .bind(userId, articleId, new Date().toISOString())
      .run();
  }
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM likes WHERE article_id = ?")
    .bind(articleId)
    .first();
  return { liked: !existing, count: row?.count || 0 };
}

export async function isRateLimited(db, key, limit = 8, windowMs = 10 * 60 * 1000) {
  const row = await db.prepare("SELECT * FROM login_attempts WHERE key = ?").bind(key).first();
  if (!row) return false;
  if (Date.now() - new Date(row.window_start).getTime() > windowMs) return false;
  return row.count >= limit;
}

export async function recordLoginAttempt(db, key, windowMs = 10 * 60 * 1000) {
  const now = new Date();
  const row = await db.prepare("SELECT * FROM login_attempts WHERE key = ?").bind(key).first();
  if (!row || Date.now() - new Date(row.window_start).getTime() > windowMs) {
    await db
      .prepare(
        `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`
      )
      .bind(key, now.toISOString())
      .run();
    return;
  }
  await db.prepare("UPDATE login_attempts SET count = count + 1 WHERE key = ?").bind(key).run();
}

export async function clearLoginAttempts(db, key) {
  await db.prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
}

export async function setBotState(db, chatId, action, commentId = null) {
  await db
    .prepare(
      `INSERT INTO bot_state (chat_id, action, comment_id, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET action = excluded.action,
         comment_id = excluded.comment_id, updated_at = excluded.updated_at`
    )
    .bind(String(chatId), action, commentId, new Date().toISOString())
    .run();
}

export async function getBotState(db, chatId) {
  return db.prepare("SELECT * FROM bot_state WHERE chat_id = ?").bind(String(chatId)).first();
}

export async function clearBotState(db, chatId) {
  await db.prepare("DELETE FROM bot_state WHERE chat_id = ?").bind(String(chatId)).run();
}

export async function listForumBoards(db) {
  const { results } = await db
    .prepare(
      `SELECT b.*,
        (SELECT COUNT(*) FROM forum_threads t WHERE t.board_id = b.id) AS thread_count,
        (SELECT COUNT(*) FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
          WHERE t.board_id = b.id) AS post_count,
        (SELECT t2.title FROM forum_threads t2 WHERE t2.board_id = b.id
          ORDER BY t2.updated_at DESC LIMIT 1) AS last_title,
        (SELECT t2.updated_at FROM forum_threads t2 WHERE t2.board_id = b.id
          ORDER BY t2.updated_at DESC LIMIT 1) AS last_at,
        (SELECT u2.username FROM forum_threads t2 JOIN users u2 ON u2.id = t2.user_id
          WHERE t2.board_id = b.id ORDER BY t2.updated_at DESC LIMIT 1) AS last_username,
        (SELECT t2.id FROM forum_threads t2 WHERE t2.board_id = b.id
          ORDER BY t2.updated_at DESC LIMIT 1) AS last_thread_id
       FROM forum_boards b
       ORDER BY b.sort_order ASC, b.id ASC`
    )
    .all();
  return results;
}

export async function getForumBoard(db, id) {
  return db.prepare("SELECT * FROM forum_boards WHERE id = ?").bind(id).first();
}

export async function listForumThreads(db, boardId, { limit = 20, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT t.*, u.username,
        (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS post_count,
        (SELECT COUNT(*) FROM forum_likes l JOIN forum_posts p ON p.id = l.post_id
          WHERE p.thread_id = t.id) AS like_count,
        (SELECT u2.username FROM forum_posts p2 JOIN users u2 ON u2.id = p2.user_id
          WHERE p2.thread_id = t.id ORDER BY p2.created_at DESC, p2.id DESC LIMIT 1) AS last_username
       FROM forum_threads t
       JOIN users u ON u.id = t.user_id
       WHERE t.board_id = ?
       ORDER BY t.pinned DESC, t.updated_at DESC, t.id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(boardId, limit, offset)
    .all();
  return results;
}

export async function countForumThreads(db, boardId) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM forum_threads WHERE board_id = ?")
    .bind(boardId)
    .first();
  return row?.count || 0;
}

export async function getForumThread(db, id) {
  return db
    .prepare(
      `SELECT t.*, u.username, u.role, b.title AS board_title,
        (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS post_count
       FROM forum_threads t
       JOIN users u ON u.id = t.user_id
       JOIN forum_boards b ON b.id = t.board_id
       WHERE t.id = ?`
    )
    .bind(id)
    .first();
}

export async function listForumPosts(db, threadId, viewerId = 0, { limit = 15, offset = 0 } = {}) {
  const { results } = await db
    .prepare(
      `SELECT p.*, u.username, u.role,
        (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
        (SELECT COUNT(*) FROM forum_posts pp WHERE pp.user_id = p.user_id) AS author_posts,
        qu.username AS quote_username, q.body AS quote_body
       FROM forum_posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN forum_posts q ON q.id = p.quote_post_id
       LEFT JOIN users qu ON qu.id = q.user_id
       WHERE p.thread_id = ?
       ORDER BY p.created_at ASC, p.id ASC
       LIMIT ? OFFSET ?`
    )
    .bind(viewerId, threadId, limit, offset)
    .all();
  return results;
}

export async function countForumPosts(db, threadId) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM forum_posts WHERE thread_id = ?")
    .bind(threadId)
    .first();
  return row?.count || 0;
}

export async function getForumPost(db, id) {
  return db
    .prepare(
      `SELECT p.*, u.username, u.role, t.title AS thread_title, t.locked, t.board_id
       FROM forum_posts p
       JOIN users u ON u.id = p.user_id
       JOIN forum_threads t ON t.id = p.thread_id
       WHERE p.id = ?`
    )
    .bind(id)
    .first();
}

export async function isThreadFirstPost(db, postId) {
  const post = await db.prepare("SELECT thread_id FROM forum_posts WHERE id = ?").bind(postId).first();
  if (!post) return false;
  const earlier = await db
    .prepare("SELECT 1 AS found FROM forum_posts WHERE thread_id = ? AND id < ? LIMIT 1")
    .bind(post.thread_id, postId)
    .first();
  return !earlier;
}

export async function createForumThread(db, { boardId, userId, title, body }) {
  const now = new Date().toISOString();
  const thread = await db
    .prepare(
      "INSERT INTO forum_threads (board_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(boardId, userId, title, now, now)
    .run();
  const threadId = thread.meta?.last_row_id;
  await db
    .prepare("INSERT INTO forum_posts (thread_id, user_id, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(threadId, userId, body, now)
    .run();
  return threadId;
}

export async function createForumPost(db, { threadId, userId, body, quotePostId = null }) {
  const now = new Date().toISOString();
  const post = await db
    .prepare(
      "INSERT INTO forum_posts (thread_id, user_id, body, quote_post_id, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(threadId, userId, body, quotePostId, now)
    .run();
  await db.prepare("UPDATE forum_threads SET updated_at = ? WHERE id = ?").bind(now, threadId).run();
  return post.meta?.last_row_id;
}

export async function updateForumPost(db, id, body) {
  await db
    .prepare("UPDATE forum_posts SET body = ?, edited_at = ? WHERE id = ?")
    .bind(body, new Date().toISOString(), id)
    .run();
}

export async function deleteForumPost(db, id) {
  await db.batch([
    db.prepare("DELETE FROM forum_likes WHERE post_id = ?").bind(id),
    db.prepare("UPDATE forum_posts SET quote_post_id = NULL WHERE quote_post_id = ?").bind(id),
    db.prepare("DELETE FROM forum_posts WHERE id = ?").bind(id),
  ]);
}

export async function deleteForumThread(db, id) {
  await db.batch([
    db
      .prepare("DELETE FROM forum_likes WHERE post_id IN (SELECT id FROM forum_posts WHERE thread_id = ?)")
      .bind(id),
    db.prepare("DELETE FROM forum_posts WHERE thread_id = ?").bind(id),
    db.prepare("DELETE FROM forum_threads WHERE id = ?").bind(id),
  ]);
}

export async function setForumThreadFlag(db, id, flag, value) {
  const column = flag === "pinned" ? "pinned" : "locked";
  await db.prepare(`UPDATE forum_threads SET ${column} = ? WHERE id = ?`).bind(value ? 1 : 0, id).run();
}

export async function incrementForumThreadViews(db, id) {
  await db.prepare("UPDATE forum_threads SET views = views + 1 WHERE id = ?").bind(id).run();
}

export async function toggleForumLike(db, userId, postId) {
  const existing = await db
    .prepare("SELECT 1 AS found FROM forum_likes WHERE user_id = ? AND post_id = ?")
    .bind(userId, postId)
    .first();
  if (existing) {
    await db.prepare("DELETE FROM forum_likes WHERE user_id = ? AND post_id = ?").bind(userId, postId).run();
    const count = await db.prepare("SELECT COUNT(*) AS count FROM forum_likes WHERE post_id = ?").bind(postId).first();
    return { liked: false, count: count?.count || 0 };
  }
  await db
    .prepare("INSERT INTO forum_likes (user_id, post_id, created_at) VALUES (?, ?, ?)")
    .bind(userId, postId, new Date().toISOString())
    .run();
  const count = await db.prepare("SELECT COUNT(*) AS count FROM forum_likes WHERE post_id = ?").bind(postId).first();
  return { liked: true, count: count?.count || 0 };
}

export async function searchForumThreads(db, term, limit = 30) {
  const like = `%${term}%`;
  const { results } = await db
    .prepare(
      `SELECT DISTINCT t.id, t.title, t.board_id, t.updated_at, t.pinned, b.title AS board_title, u.username
       FROM forum_threads t
       JOIN users u ON u.id = t.user_id
       JOIN forum_boards b ON b.id = t.board_id
       LEFT JOIN forum_posts p ON p.thread_id = t.id
       WHERE t.title LIKE ? OR p.body LIKE ?
       ORDER BY t.updated_at DESC
       LIMIT ?`
    )
    .bind(like, like, limit)
    .all();
  return results;
}

export async function getForumStats(db) {
  const threads = await db.prepare("SELECT COUNT(*) AS count FROM forum_threads").first();
  const posts = await db.prepare("SELECT COUNT(*) AS count FROM forum_posts").first();
  const members = await db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'active'")
    .first();
  const newest = await db
    .prepare("SELECT username FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 1")
    .first();
  return {
    threads: threads?.count || 0,
    posts: posts?.count || 0,
    members: members?.count || 0,
    newestMember: newest?.username || null,
  };
}
