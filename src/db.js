const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    fetched_at TEXT NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url ON articles (url)",
  "CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC)",
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  for (const statement of SCHEMA) {
    await db.prepare(statement).run();
  }
  schemaReady = true;
}

export async function getMeta(db, key) {
  const row = await db.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first();
  return row ? row.value : null;
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
  return results
    .slice(0, -1)
    .reduce((total, result) => total + (result.meta?.changes || 0), 0);
}

export async function listArticles(db, limit = 300) {
  const { results } = await db
    .prepare(
      `SELECT title, url, source, summary, image_url, published_at
       FROM articles
       ORDER BY COALESCE(published_at, fetched_at) DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results;
}

export async function getStats(db) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count, COUNT(DISTINCT source) AS sources FROM articles")
    .first();
  const last = await db
    .prepare("SELECT value FROM meta WHERE key = 'last_fetch'")
    .first();
  return {
    count: row?.count || 0,
    sources: row?.sources || 0,
    lastFetch: last?.value || null,
  };
}
