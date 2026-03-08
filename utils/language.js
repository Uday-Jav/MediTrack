const SUPPORTED_LANGUAGES = Object.freeze({
  en: { code: "en", label: "English" },
  hi: { code: "hi", label: "Hindi" },
  pa: { code: "pa", label: "Punjabi" },
  ta: { code: "ta", label: "Tamil" },
  bn: { code: "bn", label: "Bengali" },
  mr: { code: "mr", label: "Marathi" }
});

const DEFAULT_LANGUAGE = "en";

const normalizeLanguageCode = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return SUPPORTED_LANGUAGES[normalized] ? normalized : DEFAULT_LANGUAGE;
};

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  normalizeLanguageCode
};
