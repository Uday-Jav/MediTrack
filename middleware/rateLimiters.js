const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again in a few minutes."
  }
});

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.CHAT_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Chat rate limit exceeded. Please wait before sending more messages."
  }
});

const translationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.TRANSLATION_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Translation rate limit exceeded. Please try again shortly."
  }
});

module.exports = {
  apiLimiter,
  chatLimiter,
  translationLimiter
};
