const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Record = require("../models/Record");
const User = require("../models/User");
const { getTokenFromRequest } = require("../middleware/authMiddleware");

const uploadsDir = path.join(__dirname, "..", "uploads");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeRecordType = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || "Document";
};

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

const normalizeIdValue = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === "undefined" || normalized === "null" || normalized === "me") {
    return "";
  }

  return normalized;
};

const resolvePatientIdForRequest = (req) => {
  const routePatientId = normalizeIdValue(req.params?.patientId);
  const authPatientId = normalizeIdValue(req.user?.id);

  if (routePatientId && mongoose.Types.ObjectId.isValid(routePatientId)) {
    return routePatientId;
  }

  if (authPatientId && mongoose.Types.ObjectId.isValid(authPatientId)) {
    return authPatientId;
  }

  return routePatientId || authPatientId;
};

const buildPatientFilter = (patientId) => {
  const normalizedPatientId = String(patientId || "").trim();
  const filters = [{ userId: normalizedPatientId }];

  if (mongoose.Types.ObjectId.isValid(normalizedPatientId)) {
    filters.push({ patientId: new mongoose.Types.ObjectId(normalizedPatientId) });
  }

  return { $or: filters };
};

const withTokenQuery = (url, token) => {
  if (!token) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (error) {
    return String(value || "");
  }
};

const extractFileKey = (value) => {
  const rawValue = safeDecodeURIComponent(value).trim();
  if (!rawValue) {
    return "";
  }

  const parseCandidatePath = (inputPath) => {
    const normalizedPath = String(inputPath || "").replace(/\\/g, "/");
    const withoutQueryAndHash = normalizedPath.split("?")[0].split("#")[0];
    const apiMatch = withoutQueryAndHash.match(/\/api\/records\/file\/([^/]+)\/(?:preview|download)$/i);
    if (apiMatch && apiMatch[1]) {
      return safeDecodeURIComponent(apiMatch[1]);
    }

    const uploadMatch = withoutQueryAndHash.match(/\/uploads\/([^/]+)$/i);
    if (uploadMatch && uploadMatch[1]) {
      return safeDecodeURIComponent(uploadMatch[1]);
    }

    return path.basename(withoutQueryAndHash);
  };

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const parsedUrl = new URL(rawValue);
      return parseCandidatePath(parsedUrl.pathname);
    } catch (error) {
      return parseCandidatePath(rawValue);
    }
  }

  return parseCandidatePath(rawValue);
};

const buildRecordResponse = (record, req, authToken = "") => {
  const raw = record.toObject ? record.toObject() : record;
  const sanitizedRecord = { ...raw };
  delete sanitizedRecord.fileData;
  const recordId = raw._id.toString();
  const baseUrl = getBaseUrl(req);
  const fileKey = extractFileKey(raw.fileUrl) || recordId;
  const encodedFileKey = encodeURIComponent(fileKey);
  const previewUrl = withTokenQuery(
    `${baseUrl}/api/records/file/${encodedFileKey}/preview`,
    authToken
  );
  const downloadUrl = withTokenQuery(
    `${baseUrl}/api/records/file/${encodedFileKey}/download`,
    authToken
  );

  return {
    ...sanitizedRecord,
    id: recordId,
    recordId,
    fileUrl: previewUrl,
    previewUrl,
    downloadUrl
  };
};

const isStoredFilePathUsable = (candidatePath) => {
  if (!candidatePath) {
    return false;
  }

  try {
    return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile();
  } catch (error) {
    return false;
  }
};

const resolveStoredFilePath = (record) => {
  const fileUrlKey = extractFileKey(record?.fileUrl);
  const originalNameKey = extractFileKey(record?.fileName);
  const candidates = [fileUrlKey, originalNameKey]
    .filter(Boolean)
    .map((key) => path.join(uploadsDir, path.basename(key)));

  for (const candidatePath of candidates) {
    if (isStoredFilePathUsable(candidatePath)) {
      return candidatePath;
    }
  }

  return "";
};

const applyFileDataSelection = (query, includeFileData) => {
  if (includeFileData) {
    return query.select("+fileData");
  }

  return query;
};

const findRecordByFileKey = async (fileKey, includeFileData = false) => {
  const normalizedKey = extractFileKey(fileKey);

  if (!normalizedKey) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(normalizedKey)) {
    const recordById = await applyFileDataSelection(Record.findById(normalizedKey), includeFileData);
    if (recordById) {
      return recordById;
    }
  }

  const safeFileName = path.basename(normalizedKey);
  if (!safeFileName) {
    return null;
  }

  const directMatchQuery = Record.findOne({
    $or: [{ fileUrl: `/uploads/${safeFileName}` }, { fileName: safeFileName }]
  }).sort({ createdAt: -1 });
  const directMatchWithFields = await applyFileDataSelection(directMatchQuery, includeFileData);

  if (directMatchWithFields) {
    return directMatchWithFields;
  }

  const fileUrlPattern = new RegExp(`${escapeRegex(safeFileName)}(?:\\?.*)?$`, "i");
  const patternMatchQuery = Record.findOne({ fileUrl: fileUrlPattern }).sort({ createdAt: -1 });
  return applyFileDataSelection(patternMatchQuery, includeFileData);
};

const isRecordOwnedByUser = (record, userId) => {
  if (!record || !userId) {
    return false;
  }

  const ownerId = record.patientId ? String(record.patientId) : "";
  const altOwnerId = record.userId ? String(record.userId) : "";
  return ownerId === userId || altOwnerId === userId;
};

const getAuthenticatedUser = async (req, includePassword = false) => {
  const authenticatedUserId = normalizeIdValue(req.user?.id);
  if (!mongoose.Types.ObjectId.isValid(authenticatedUserId)) {
    return null;
  }

  const selectedFields = includePassword ? "role vaultAccess password" : "role vaultAccess";
  return User.findById(authenticatedUserId).select(selectedFields);
};

const isVaultEnabledForUser = (user) => Boolean(user) && user.vaultAccess !== false;

const canAccessPatientVault = (user, patientId) => {
  if (!isVaultEnabledForUser(user) || !patientId) {
    return false;
  }

  if (user.role === "doctor") {
    return true;
  }

  return String(user._id) === String(patientId);
};

const canAccessRecord = (user, record) => {
  if (!isVaultEnabledForUser(user) || !record) {
    return false;
  }

  if (user.role === "doctor") {
    return true;
  }

  return isRecordOwnedByUser(record, String(user._id));
};

const verifyPassword = async (user, password) => {
  if (!user?.password || !password) {
    return false;
  }

  return bcrypt.compare(password, user.password);
};

const sendStoredBuffer = (res, record, dispositionType = "inline") => {
  const binaryData = record?.fileData;
  if (!Buffer.isBuffer(binaryData) || binaryData.length === 0) {
    return false;
  }

  const safeFileName = (record.fileName || "record").replace(/"/g, "");
  res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `${dispositionType}; filename=\"${safeFileName}\"`);
  return res.send(binaryData);
};

const uploadRecord = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    const authPatientId = String(authenticatedUser._id);
    const bodyPatientId = normalizeIdValue(req.body?.patientId);
    const patientId =
      authenticatedUser.role === "doctor" ? bodyPatientId || authPatientId : authPatientId;
    const { title, description, type } = req.body;
    const authToken = req.authToken || getTokenFromRequest(req);

    if (authenticatedUser.role !== "doctor" && bodyPatientId && bodyPatientId !== authPatientId) {
      return res.status(403).json({ message: "You are not allowed to upload records for another user." });
    }

    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    if (!normalizedTitle) {
      return res.status(400).json({ message: "title is required." });
    }

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "A file is required." });
    }

    let fileDataBuffer = null;
    try {
      if (req.file.path) {
        fileDataBuffer = await fs.promises.readFile(req.file.path);
      }
    } catch (fileReadError) {
      fileDataBuffer = null;
    }

    const record = await Record.create({
      patientId,
      userId: patientId,
      title: normalizedTitle,
      type: normalizeRecordType(type),
      description: typeof description === "string" ? description : "",
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || "application/octet-stream",
      fileData: fileDataBuffer || undefined,
      fileSize: Number(req.file.size) || 0
    });

    return res.status(201).json({
      message: "Medical record uploaded successfully.",
      record: buildRecordResponse(record, req, authToken)
    });
  } catch (error) {
    return res.status(500).json({ message: "Record upload failed.", error: error.message });
  }
};

const getRecordsByPatientId = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const patientId = resolvePatientIdForRequest(req);
    const search = (req.query.search || req.query.q || "").trim();
    const authToken = req.authToken || getTokenFromRequest(req);

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    if (!canAccessPatientVault(authenticatedUser, patientId)) {
      return res.status(403).json({ message: "You are not allowed to access this vault." });
    }

    const filter = buildPatientFilter(patientId);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$and = [{ $or: [{ title: pattern }, { description: pattern }, { fileName: pattern }] }];
    }

    const records = await Record.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Medical history fetched successfully.",
      count: records.length,
      records: records.map((record) => buildRecordResponse(record, req, authToken))
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch records.", error: error.message });
  }
};

const getRecentRecords = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const patientId = resolvePatientIdForRequest(req);
    const authToken = req.authToken || getTokenFromRequest(req);

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    if (!canAccessPatientVault(authenticatedUser, patientId)) {
      return res.status(403).json({ message: "You are not allowed to access this vault." });
    }

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsedLimit) ? 5 : Math.min(Math.max(parsedLimit, 1), 50);

    const records = await Record.find(buildPatientFilter(patientId))
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      message: "Recent medical records fetched successfully.",
      count: records.length,
      records: records.map((record) => buildRecordResponse(record, req, authToken))
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch recent records.", error: error.message });
  }
};

const getVaultStatus = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const patientId = resolvePatientIdForRequest(req);

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    if (!canAccessPatientVault(authenticatedUser, patientId)) {
      return res.status(403).json({ message: "You are not allowed to access this vault." });
    }

    const records = await Record.find(buildPatientFilter(patientId))
      .sort({ createdAt: -1 })
      .select("fileSize createdAt");

    const totalRecords = records.length;
    const totalFileSize = records.reduce((sum, record) => sum + (record.fileSize || 0), 0);
    const lastAddedAt = totalRecords > 0 ? records[0].createdAt : null;

    const vaultStatus = {
      totalRecords,
      totalFileSize,
      lastAddedAt
    };

    return res.status(200).json({
      message: "Vault status fetched successfully.",
      status: vaultStatus,
      storage: vaultStatus
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch vault status.", error: error.message });
  }
};

const previewRecord = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const fileKey = req.params.filename || req.params.recordId;

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    const record = await findRecordByFileKey(fileKey, true);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    if (!canAccessRecord(authenticatedUser, record)) {
      return res.status(403).json({ message: "You are not allowed to access this record." });
    }

    const filePath = resolveStoredFilePath(record);
    if (isStoredFilePathUsable(filePath)) {
      const safeFileName = (record.fileName || path.basename(filePath)).replace(/"/g, "");
      res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename=\"${safeFileName}\"`);
      return res.sendFile(filePath);
    }

    const sentFromDb = sendStoredBuffer(res, record, "inline");
    if (sentFromDb) {
      return sentFromDb;
    }

    return res.status(404).json({ message: "Stored file not found." });
  } catch (error) {
    return res.status(500).json({ message: "Could not preview record file.", error: error.message });
  }
};

const downloadRecord = async (req, res) => {
  try {
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const fileKey = req.params.filename || req.params.recordId;

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    const record = await findRecordByFileKey(fileKey, true);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    if (!canAccessRecord(authenticatedUser, record)) {
      return res.status(403).json({ message: "You are not allowed to access this record." });
    }

    const filePath = resolveStoredFilePath(record);
    if (isStoredFilePathUsable(filePath)) {
      const safeFileName = (record.fileName || path.basename(filePath)).replace(/"/g, "");
      return res.download(filePath, safeFileName);
    }

    const sentFromDb = sendStoredBuffer(res, record, "attachment");
    if (sentFromDb) {
      return sentFromDb;
    }

    return res.status(404).json({ message: "Stored file not found." });
  } catch (error) {
    return res.status(500).json({ message: "Could not download record file.", error: error.message });
  }
};

const updateRecord = async (req, res) => {
  try {
    const fileKey = req.params.filename || req.params.recordId;
    const payload = req.body || {};
    const hasTitle = Object.prototype.hasOwnProperty.call(payload, "title");
    const hasDescription = Object.prototype.hasOwnProperty.call(payload, "description");
    const { password } = payload;

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    if (!hasTitle && !hasDescription) {
      return res.status(400).json({ message: "title or description is required for update." });
    }

    if (hasTitle && typeof payload.title !== "string") {
      return res.status(400).json({ message: "title must be a string." });
    }

    if (hasDescription && typeof payload.description !== "string") {
      return res.status(400).json({ message: "description must be a string." });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required to edit a record." });
    }

    const authenticatedUser = await getAuthenticatedUser(req, true);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    const record = await findRecordByFileKey(fileKey);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    if (!isRecordOwnedByUser(record, String(authenticatedUser._id))) {
      return res.status(403).json({ message: "You are not allowed to edit this record." });
    }

    const isPasswordValid = await verifyPassword(authenticatedUser, password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    if (hasTitle) {
      const normalizedTitle = payload.title.trim();
      if (!normalizedTitle) {
        return res.status(400).json({ message: "title cannot be empty." });
      }

      record.title = normalizedTitle;
    }

    if (hasDescription) {
      record.description = payload.description;
    }

    await record.save();

    const authToken = req.authToken || getTokenFromRequest(req);
    return res.status(200).json({
      message: "Record updated successfully.",
      record: buildRecordResponse(record, req, authToken)
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not update record.", error: error.message });
  }
};

const deleteRecord = async (req, res) => {
  try {
    const fileKey = req.params.filename || req.params.recordId;
    const { password } = req.body || {};

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required to delete a record." });
    }

    const authenticatedUser = await getAuthenticatedUser(req, true);
    if (!authenticatedUser) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    if (!isVaultEnabledForUser(authenticatedUser)) {
      return res.status(403).json({ message: "Vault access is disabled for this user." });
    }

    const record = await findRecordByFileKey(fileKey);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    if (!isRecordOwnedByUser(record, String(authenticatedUser._id))) {
      return res.status(403).json({ message: "You are not allowed to delete this record." });
    }

    const isPasswordValid = await verifyPassword(authenticatedUser, password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    const filePath = resolveStoredFilePath(record);
    await Record.deleteOne({ _id: record._id });

    if (isStoredFilePathUsable(filePath)) {
      await fs.promises.unlink(filePath);
    }

    return res.status(200).json({
      message: "Record deleted successfully.",
      deletedRecordId: record._id
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not delete record file.", error: error.message });
  }
};

module.exports = {
  uploadRecord,
  getRecordsByPatientId,
  getRecentRecords,
  getVaultStatus,
  previewRecord,
  downloadRecord,
  updateRecord,
  deleteRecord
};
