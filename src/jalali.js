const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
  1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => Math.trunc(a / b);
const mod = (a, b) => a - div(a, b) * b;

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4);
  d += div(153 * mod(gm + 9, 12) + 2, 5);
  d += gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return [gy, gm, gd];
}

function jalCal(jy) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]) {
    throw new Error("Jalali year out of range");
  }
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return [leap, march];
}

function d2j(jdn) {
  const gy = d2g(jdn)[0];
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r[1]);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return [jy, 1 + div(k, 31), mod(k, 31) + 1];
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r[0] === 1) k += 1;
  }
  return [jy, 7 + div(k, 30), mod(k, 30) + 1];
}

export function toJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

const TEHRAN_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function tehranParts(date) {
  const parts = {};
  for (const part of TEHRAN_FORMAT.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function fa(value) {
  return String(value).replace(/[0-9]/g, (digit) => DIGITS[Number(digit)]);
}

export function parseDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function localDayKey(date) {
  const parts = tehranParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function weekdayOf(parts) {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return WEEKDAYS[(day + 1) % 7];
}

export function dayParts(date, now = new Date()) {
  const parts = tehranParts(date);
  const today = tehranParts(now);
  const [jy, jm, jd] = toJalali(parts.year, parts.month, parts.day);
  const [todayYear] = toJalali(today.year, today.month, today.day);
  const weekday = weekdayOf(parts);
  let dateText = `${weekday} ${fa(jd)} ${MONTHS[jm - 1]}`;

  const dayMs = Date.UTC(parts.year, parts.month - 1, parts.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  if (dayMs === todayMs) return ["امروز", dateText];
  if (dayMs === todayMs - 86400000) return ["دیروز", dateText];

  if (jy !== todayYear) dateText += ` ${fa(jy)}`;
  return [`${fa(jd)} ${MONTHS[jm - 1]}`, dateText];
}

export function formatFull(date) {
  const parts = tehranParts(date);
  const [jy, jm, jd] = toJalali(parts.year, parts.month, parts.day);
  const clock = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return `${weekdayOf(parts)} ${fa(jd)} ${MONTHS[jm - 1]} ${fa(jy)}، ساعت ${fa(clock)}`;
}

export function relative(date, now = new Date()) {
  const seconds = (now.getTime() - date.getTime()) / 1000;
  if (seconds < 60) return "همین حالا";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`;

  const parts = tehranParts(date);
  const today = tehranParts(now);
  const dayMs = Date.UTC(parts.year, parts.month - 1, parts.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const days = Math.round((todayMs - dayMs) / 86400000);

  if (days <= 0) return `${fa(Math.floor(minutes / 60))} ساعت پیش`;
  if (days === 1) return "دیروز";
  if (days < 7) return `${fa(days)} روز پیش`;

  const [jy, jm, jd] = toJalali(parts.year, parts.month, parts.day);
  return `${fa(jd)} ${MONTHS[jm - 1]}`;
}
