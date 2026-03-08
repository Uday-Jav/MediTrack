const formatValidationErrors = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));

const validateBody = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid request body.",
      errors: formatValidationErrors(parsed.error.issues)
    });
  }

  req.validatedBody = parsed.data;
  return next();
};

const validateQuery = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid query parameters.",
      errors: formatValidationErrors(parsed.error.issues)
    });
  }

  req.validatedQuery = parsed.data;
  return next();
};

const validateParams = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid route parameters.",
      errors: formatValidationErrors(parsed.error.issues)
    });
  }

  req.validatedParams = parsed.data;
  return next();
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};
