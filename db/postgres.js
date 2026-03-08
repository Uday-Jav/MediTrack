const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const parseBoolean = (value) => String(value || "").trim().toLowerCase() === "true";

let activePool = null;
let usingInMemoryDb = false;

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

const createPgPool = () => {
  const pool = new Pool(buildPoolConfig());
  pool.on("error", (error) => {
    console.error(`Unexpected PostgreSQL pool error: ${error.message}`);
  });
  return pool;
};

const createInMemoryPool = () => {
  const { newDb } = require("pg-mem");
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(schemaSql);

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  usingInMemoryDb = true;
  console.warn("Using in-memory PostgreSQL fallback (pg-mem).");
  return pool;
};

const getPool = () => {
  if (!activePool) {
    activePool = createPgPool();
  }
  return activePool;
};

const enableMemoryFallback = () => {
  if (usingInMemoryDb && activePool) {
    return activePool;
  }

  activePool = createInMemoryPool();
  return activePool;
};

const query = (text, params = []) => getPool().query(text, params);

const ensurePostgresConnection = async () => {
  const pool = getPool();
  let client = null;

  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("PostgreSQL connected.");
  } catch (error) {
    if (client) {
      client.release();
    }

    if (!parseBoolean(process.env.POSTGRES_FALLBACK_MEMORY)) {
      throw error;
    }

    console.warn(`PostgreSQL connection failed (${error.message}).`);
    const fallbackPool = enableMemoryFallback();
    const fallbackClient = await fallbackPool.connect();
    await fallbackClient.query("SELECT 1");
    fallbackClient.release();
  }
};

module.exports = {
  query,
  ensurePostgresConnection,
  isUsingInMemoryDb: () => usingInMemoryDb
};
