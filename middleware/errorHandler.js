const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const safeMessage =
    statusCode >= 500
      ? "Something went wrong while processing your request."
      : error.message || "Request failed.";

  if (statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}] ${error.stack || error.message}`);
  }

  const payload = { message: safeMessage };

  if (process.env.NODE_ENV !== "production" && error.message) {
    payload.error = error.message;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
