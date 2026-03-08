const express = require("express");
const { translateSingleText, translateBatchText } = require("../controllers/translationController");
const { validateBody } = require("../middleware/validation");
const { translationLimiter } = require("../middleware/rateLimiters");
const { translateTextSchema, translateBatchSchema } = require("../validators/translationSchemas");

const router = express.Router();

router.post("/", translationLimiter, validateBody(translateTextSchema), translateSingleText);
router.post("/batch", translationLimiter, validateBody(translateBatchSchema), translateBatchText);

module.exports = router;
