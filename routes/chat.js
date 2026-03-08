const express = require("express");
const { handleChatRequest, getChatHistory } = require("../controllers/chatController");
const { validateBody, validateQuery, validateParams } = require("../middleware/validation");
const { chatLimiter } = require("../middleware/rateLimiters");
const {
  chatRequestSchema,
  historyParamsSchema,
  historyQuerySchema
} = require("../validators/chatSchemas");

const router = express.Router();

router.post("/", chatLimiter, validateBody(chatRequestSchema), handleChatRequest);
router.get(
  "/history/:userId",
  chatLimiter,
  validateParams(historyParamsSchema),
  validateQuery(historyQuerySchema),
  getChatHistory
);

module.exports = router;
