const { translate } = require("@vitalets/google-translate-api");
const { normalizeLanguageCode } = require("../utils/language");

const MAX_CACHE_ITEMS = 5000;
const translationCache = new Map();

const trimCacheIfNeeded = () => {
  if (translationCache.size < MAX_CACHE_ITEMS) {
    return;
  }

  const oldestKey = translationCache.keys().next().value;
  if (oldestKey) {
    translationCache.delete(oldestKey);
  }
};

const makeCacheKey = (text, to, from) => `${from}:${to}:${text}`;

const translateText = async (text, targetLanguage, sourceLanguage = "auto") => {
  const normalizedText = String(text || "").trim();
  const to = normalizeLanguageCode(targetLanguage);
  const from = sourceLanguage === "auto" ? "auto" : normalizeLanguageCode(sourceLanguage);

  if (!normalizedText) {
    return "";
  }

  if (to === "en" && from === "en") {
    return normalizedText;
  }

  const cacheKey = makeCacheKey(normalizedText, to, from);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const translation = await translate(normalizedText, { to, from });
  trimCacheIfNeeded();
  translationCache.set(cacheKey, translation.text);
  return translation.text;
};

const translateBatch = async (texts, targetLanguage, sourceLanguage = "auto") => {
  const uniqueTexts = [...new Set(texts.map((entry) => String(entry || "").trim()).filter(Boolean))];
  const translatedMap = new Map();

  await Promise.all(
    uniqueTexts.map(async (entry) => {
      const translated = await translateText(entry, targetLanguage, sourceLanguage);
      translatedMap.set(entry, translated);
    })
  );

  return texts.map((entry) => {
    const normalized = String(entry || "").trim();
    return translatedMap.get(normalized) || normalized;
  });
};

module.exports = {
  translateText,
  translateBatch
};
