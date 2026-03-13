const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const parseBoolean = (value) => String(value || "").trim().toLowerCase() === "true";
const hasBooleanEnv = (value) => ["true", "false"].includes(String(value || "").trim().toLowerCase());
const hasConfiguredValue = (value) => String(value ?? "").trim() !== "";

const shouldUseSslFromConnectionString = (connectionString) => {
  try {
    const parsed = new URL(connectionString);
    const sslmode = String(parsed.searchParams.get("sslmode") || "").toLowerCase();
    const ssl = String(parsed.searchParams.get("ssl") || "").toLowerCase();

    if (["require", "verify-ca", "verify-full"].includes(sslmode)) {
      return true;
    }

    return ["1", "true", "yes"].includes(ssl);
  } catch (error) {
    return false;
  }
};

let activePool = null;
let usingInMemoryDb = false;

const hasExplicitPostgresConfig = () =>
  [
    process.env.DATABASE_URL,
    process.env.POSTGRES_HOST,
    process.env.POSTGRES_PORT,
    process.env.POSTGRES_DB,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD
  ].some(hasConfiguredValue);

const shouldAllowMemoryFallback = () =>
  parseBoolean(process.env.POSTGRES_FALLBACK_MEMORY) || !hasExplicitPostgresConfig();

const buildPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  const envHasSslToggle = hasBooleanEnv(process.env.POSTGRES_SSL);
  const sslEnabled = envHasSslToggle
    ? parseBoolean(process.env.POSTGRES_SSL)
    : connectionString
      ? shouldUseSslFromConnectionString(connectionString)
      : false;
  const rejectUnauthorized = parseBoolean(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED);
  const localPassword = String(process.env.POSTGRES_PASSWORD ?? "");
  const sharedConfig = {
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONN_TIMEOUT_MS || 10000)
  };

  if (connectionString) {
    return {
      ...sharedConfig,
      connectionString,
      // Do not override password when DATABASE_URL is provided; URL credentials should be authoritative.
      ssl: sslEnabled ? { rejectUnauthorized } : undefined
    };
  }

  return {
    ...sharedConfig,
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || "medivault",
    user: process.env.POSTGRES_USER || "postgres",
    password: localPassword,
    ssl: sslEnabled ? { rejectUnauthorized } : undefined
  };
};

const createPgPool = () => {
  const pool = new Pool(buildPoolConfig());
  pool.on("error", (error) => {
    console.error(`Unexpected PostgreSQL pool error: ${error.message}`);
  });
  return pool;
};

const createInMemoryPool = (reason = "") => {
  const { newDb } = require("pg-mem");
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.none(schemaSql);

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  usingInMemoryDb = true;
  const suffix = reason ? ` ${reason}` : "";
  console.warn(`Using in-memory PostgreSQL fallback (pg-mem).${suffix}`);
  return pool;
};

const getPool = () => {
  if (!activePool) {
    activePool = hasExplicitPostgresConfig()
      ? createPgPool()
      : createInMemoryPool("No PostgreSQL configuration was provided.");
  }
  return activePool;
};

const enableMemoryFallback = (reason = "") => {
  if (usingInMemoryDb && activePool) {
    return activePool;
  }

  activePool = createInMemoryPool(reason);
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
    console.log(
      usingInMemoryDb ? "PostgreSQL fallback ready (in-memory)." : "PostgreSQL connected."
    );
  } catch (error) {
    if (client) {
      client.release();
    }

    if (!shouldAllowMemoryFallback()) {
      throw error;
    }

    console.warn(`PostgreSQL connection failed (${error.message}).`);
    const fallbackPool = enableMemoryFallback("Continuing with demo-safe storage.");
    const fallbackClient = await fallbackPool.connect();
    await fallbackClient.query("SELECT 1");
    fallbackClient.release();
  }
};

const closePostgresConnection = async () => {
  if (!activePool) {
    return;
  }

  const pool = activePool;
  activePool = null;
  usingInMemoryDb = false;

  if (typeof pool.end === "function") {
    await pool.end();
  }
};

module.exports = {
  query,
  ensurePostgresConnection,
  closePostgresConnection,
  isUsingInMemoryDb: () => usingInMemoryDb
};
