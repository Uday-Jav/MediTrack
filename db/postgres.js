const { Pool } = require("pg");

const parseBoolean = (value) => String(value || "").trim().toLowerCase() === "true";

const buildPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  const sslEnabled = parseBoolean(process.env.POSTGRES_SSL);
  const fallbackPassword = String(process.env.POSTGRES_PASSWORD ?? "postgres");
  const sharedConfig = {
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONN_TIMEOUT_MS || 10000)
  };

  if (connectionString) {
    return {
      ...sharedConfig,
      connectionString,
      password: fallbackPassword,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
  }

  return {
    ...sharedConfig,
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || "medivault",
    user: process.env.POSTGRES_USER || "postgres",
    password: fallbackPassword,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
};

const pool = new Pool(buildPoolConfig());

pool.on("error", (error) => {
  console.error(`Unexpected PostgreSQL pool error: ${error.message}`);
});

const query = (text, params = []) => pool.query(text, params);

const ensurePostgresConnection = async () => {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connected.");
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  ensurePostgresConnection
};
