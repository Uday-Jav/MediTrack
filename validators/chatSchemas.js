const { z } = require("zod");

const languageEnum = z.enum(["en", "hi", "pa", "ta", "bn", "mr"]);

const chatRequestSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(2000),
  language: languageEnum.optional().default("en"),
  conversationId: z.string().trim().min(1).max(64).optional(),
  stream: z.boolean().optional().default(false)
});

const historyParamsSchema = z.object({
  userId: z.string().trim().min(1).max(64)
});

const historyQuerySchema = z.object({
  conversationId: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

module.exports = {
  chatRequestSchema,
  historyParamsSchema,
  historyQuerySchema
};
