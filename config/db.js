const dns = require("dns");
const mongoose = require("mongoose");

const configureDnsForMongoSrv = (mongoUri) => {
  if (!mongoUri || !mongoUri.startsWith("mongodb+srv://")) {
    return;
  }

  const dnsServersFromEnv = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (dnsServersFromEnv.length > 0) {
    dns.setServers(dnsServersFromEnv);
    return;
  }

  const activeServers = dns.getServers();
  if (activeServers.length === 1 && activeServers[0] === "127.0.0.1") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const dbName =
      process.env.MONGODB_DB_NAME || process.env.MONGO_DB_NAME || process.env.DB_NAME;

    if (!mongoUri) {
      console.log("MongoDB URI not provided. Skipping MongoDB connection.");
      return false;
    }

    configureDnsForMongoSrv(mongoUri);

    const options = dbName ? { dbName } : {};
    await mongoose.connect(mongoUri, options);
    console.log(`MongoDB Connected${dbName ? ` (${dbName})` : ""}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    return false;
  }
};

module.exports = connectDB;
