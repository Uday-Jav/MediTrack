require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const connectMongo = require("./config/db");
const { ensurePostgresConnection, closePostgresConnection } = require("./db/postgres");
const { apiLimiter } = require("./middleware/rateLimiters");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const recordRoutes = require("./routes/recordRoutes");
const chatRoutes = require("./routes/chat");
const translationRoutes = require("./routes/translation");

const app = express();
let activeServer = null;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const corsError = new Error("Not allowed by CORS");
    corsError.statusCode = 403;
    return callback(corsError);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "MediVault backend is running.", status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/translate", translationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async ({ port = PORT } = {}) => {
  if (activeServer) {
    return activeServer;
  }

  await ensurePostgresConnection();
  await connectMongo();

  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    const cleanupListeners = () => {
      server.off("error", handleError);
      server.off("listening", handleListening);
    };

    const handleError = (error) => {
      cleanupListeners();
      reject(error);
    };

    const handleListening = () => {
      cleanupListeners();
      activeServer = server;
      const resolvedPort = server.address()?.port || port;
      console.log(`Server running on port ${resolvedPort}`);
      resolve(server);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
  });
};

const stopServer = async () => {
  const server = activeServer;
  activeServer = null;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await closePostgresConnection();
};

if (require.main === module) {
  startServer().catch((error) => {
    const message =
      error.code === "EADDRINUSE"
        ? `Port ${PORT} is already in use.`
        : error.message;
    console.error("Server startup failed:", message);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
  stopServer
};
