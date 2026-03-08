const { z } = require("zod");

const languageEnum = z.enum(["en", "hi", "pa", "ta", "bn", "mr"]);
const sourceLanguageSchema = z.union([languageEnum, z.literal("auto")]).optional().default("auto");

const translateTextSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  targetLanguage: languageEnum,
  sourceLanguage: sourceLanguageSchema
});

const translateBatchSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(2000)).min(1).max(150),
  targetLanguage: languageEnum,
  sourceLanguage: sourceLanguageSchema
});

module.exports = {
  translateTextSchema,
  translateBatchSchema
};
