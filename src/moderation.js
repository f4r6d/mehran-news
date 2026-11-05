const PROFANITY = [
  "کس",
  "کص",
  "کیر",
  "کون",
  "کونی",
  "جنده",
  "جندگی",
  "حرومزاده",
  "حرومزاده",
  "بی ناموس",
  "بیناموس",
  "ناموس فروش",
  "مادر خراب",
  "مادرجنده",
  "خواهرجنده",
  "سگ زاده",
  "سگ زاده",
  "پدرسگ",
  "پدر سگ",
  "پدرخر",
  "پدرسوخته",
  "دیوث",
  "دیوس",
  "قرمساق",
  "قرمساغ",
  "بی شرف",
  "بیشرف",
  "بی غیرت",
  "بیغیرت",
  "کثافت",
  "عن",
  "گوه",
  "گه",
  "شاش",
  "خایه",
  "خایمال",
  "حرام لقمه",
  "فاحشه",
  "روسپی",
  "لاشی",
  "جاکش",
  "کش جنده",
  "مفت خور",
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "whore",
  "slut",
  "cunt",
  "dick",
];

const PHRASES = [
  "مادرخراب",
  "مادرجنده",
  "خواهرجنده",
  "پدرسگ",
  "پدرسوخته",
  "بیناموس",
  "بیناموس",
  "بیشرف",
  "بیغیرت",
  "حراملقمه",
  "مفتخور",
  "کشجنده",
  "ناموسفروش",
];

const TOKENS = new Set(PROFANITY.map((word) => word.replace(/\s+/g, "")));

export function normalizeFa(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[آإأ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/ء/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[@]/g, "a")
    .replace(/\$/g, "s")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsProfanity(text) {
  const normalized = normalizeFa(text);
  if (!normalized) return false;
  const joined = normalized.replace(/\s+/g, "");
  for (const phrase of PHRASES) {
    if (joined.includes(phrase)) return true;
  }
  for (const token of normalized.split(" ")) {
    if (TOKENS.has(token)) return true;
  }
  return false;
}

export function checkComment(text) {
  const body = String(text ?? "").trim();
  if (body.length < 2) {
    return { ok: false, message: "متن نظر خیلی کوتاه است." };
  }
  if (body.length > 1200) {
    return { ok: false, message: "متن نظر نباید بیشتر از ۱۲۰۰ نویسه باشد." };
  }
  if (containsProfanity(body)) {
    return { ok: false, message: "متن نظر شامل کلمات نامناسب است؛ لطفاً آن را اصلاح کنید." };
  }
  return { ok: true, body };
}
