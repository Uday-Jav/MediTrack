const jwt = require("jsonwebtoken");

const extractTokenFromHeader = (authHeader = "") => {
  const trimmedAuthHeader = String(authHeader).trim();

  if (!trimmedAuthHeader) {
    return "";
  }

  if (trimmedAuthHeader.startsWith("Bearer ")) {
    return trimmedAuthHeader.slice(7).trim();
  }

  // Fallback for clients sending the raw token value.
  return trimmedAuthHeader;
};

const getTokenFromRequest = (req) => {
  const headerToken = extractTokenFromHeader(req.headers.authorization);
  if (headerToken) {
    return headerToken;
  }

  const queryToken = typeof req.query?.token === "string" ? req.query.token.trim() : "";
  if (queryToken) {
    return queryToken;
  }

  const accessToken =
    typeof req.query?.access_token === "string" ? req.query.access_token.trim() : "";
  if (accessToken) {
    return accessToken;
  }

  const cookieToken = typeof req.cookies?.token === "string" ? req.cookies.token.trim() : "";
  if (cookieToken) {
    return cookieToken;
  }

  return "";
};

const protect = (req, res, next) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET is not configured." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.authToken = token;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = { protect, getTokenFromRequest };
