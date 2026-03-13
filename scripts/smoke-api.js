require("dotenv").config();

const assert = require("assert/strict");
const { Blob } = require("buffer");
const { startServer, stopServer } = require("../server");

const requireEnv = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required for the auth/records smoke test.`);
  }
};

const expectJson = async (response, label) => {
  const text = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned non-JSON content: ${text}`);
  }

  return payload;
};

const main = async () => {
  requireEnv("JWT_SECRET");

  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    throw new Error("MONGODB_URI (or MONGO_URI) is required for the auth/records smoke test.");
  }

  let server = null;

  try {
    server = await startServer({ port: 0 });
    const port = server.address()?.port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const email = `codex-smoke-${Date.now()}@example.com`;
    const password = "Passw0rd!";

    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 200, "root health check should return 200");

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Codex Smoke",
        email,
        password,
        role: "patient"
      })
    });
    const registerPayload = await expectJson(registerResponse, "register");
    assert.equal(registerResponse.status, 201, "register should return 201");
    assert.ok(registerPayload.token, "register should return a JWT token");
    assert.equal(registerPayload.user?.email, email, "register should echo the created user");

    const token = registerPayload.token;
    const userId = registerPayload.user?.id;
    assert.ok(userId, "register should return a user id");

    const uploadData = new FormData();
    uploadData.append("title", "Smoke Test Record");
    uploadData.append("description", "Created by automated smoke test");
    uploadData.append("type", "Lab Report");
    uploadData.append("patientId", userId);
    uploadData.append(
      "file",
      new Blob(["hello medivault"], { type: "text/plain" }),
      "smoke.txt"
    );

    const uploadResponse = await fetch(`${baseUrl}/api/records/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadData
    });
    const uploadPayload = await expectJson(uploadResponse, "upload");
    assert.equal(uploadResponse.status, 201, "upload should return 201");
    assert.equal(uploadPayload.record?.type, "Lab Report", "upload should persist the record type");

    const recentResponse = await fetch(`${baseUrl}/api/records/${userId}/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const recentPayload = await expectJson(recentResponse, "recent");
    assert.equal(recentResponse.status, 200, "recent records should return 200");
    assert.equal(recentPayload.count, 1, "recent records should include the uploaded document");

    const vaultResponse = await fetch(`${baseUrl}/api/records/${userId}/vault-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const vaultPayload = await expectJson(vaultResponse, "vault status");
    assert.equal(vaultResponse.status, 200, "vault status should return 200");
    assert.equal(
      vaultPayload.status?.totalRecords,
      1,
      "vault status should count the uploaded document"
    );

    const recordId = uploadPayload.record?.recordId || uploadPayload.record?.id;
    assert.ok(recordId, "upload should return a record id");

    const deleteResponse = await fetch(
      `${baseUrl}/api/records/file/${encodeURIComponent(recordId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      }
    );
    const deletePayload = await expectJson(deleteResponse, "delete");
    assert.equal(deleteResponse.status, 200, "delete should return 200");
    assert.equal(
      deletePayload.deletedRecordId,
      recordId,
      "delete should confirm the removed record"
    );

    console.log("Smoke API test passed.");
  } finally {
    await stopServer();
  }
};

main().catch((error) => {
  console.error("Smoke API test failed:");
  console.error(error.message);
  process.exit(1);
});
