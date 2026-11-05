const encoder = new TextEncoder();
const ITERATIONS = 15000;
const KEY_LENGTH = 32;
export const SESSION_COOKIE = "mehran_sid";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function base64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomToken(byteLength = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations },
    key,
    KEY_LENGTH * 8
  );
  return base64Url(bits);
}

export async function makePassword(password) {
  const salt = randomToken(16);
  const hash = await derive(password, salt, ITERATIONS);
  return { salt, hash };
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifyPassword(password, salt, expectedHash) {
  try {
    const hash = await derive(password, salt, ITERATIONS);
    return timingSafeEqual(hash, expectedHash);
  } catch {
    return false;
  }
}

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function sessionCookie(token, secure) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure) {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(userId, tokenHash, now.toISOString(), expiresAt)
    .run();
  return token;
}

export async function getSessionUser(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const user = await db
    .prepare(
      `SELECT u.id, u.username, u.role, u.status, u.telegram_chat_id, u.telegram_username,
              u.phone, u.notify_enabled, u.notify_allowed, u.created_at,
              s.token_hash
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`
    )
    .bind(tokenHash, new Date().toISOString())
    .first();
  return user || null;
}

export async function destroySession(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

function isLoopback(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function portOf(url) {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}

export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  if (!origin || origin === "null") {
    return !site || site === "same-origin" || site === "none";
  }
  try {
    const originUrl = new URL(origin);
    if (!/^https?:$/.test(originUrl.protocol)) return false;
  } catch {
    return false;
  }
  try {
    const originUrl = new URL(origin);
    const candidates = [new URL(request.url).host, request.headers.get("Host")].filter(Boolean);
    if (candidates.includes(originUrl.host)) return true;
    return candidates.some((candidate) => {
      const target = new URL(`http://${candidate}`);
      return (
        isLoopback(originUrl.hostname) &&
        isLoopback(target.hostname) &&
        portOf(originUrl) === portOf(target)
      );
    });
  } catch {
    return false;
  }
}

export function clientKey(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local"
  );
}
