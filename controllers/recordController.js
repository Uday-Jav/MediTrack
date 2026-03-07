const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Record = require("../models/Record");
const User = require("../models/User");
const { getTokenFromRequest } = require("../middleware/authMiddleware");

const uploadsDir = path.join(__dirname, "..", "uploads");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

const buildPatientFilter = (patientId) => ({
  $or: [{ patientId }, { userId: patientId }]
});

const withTokenQuery = (url, token) => {
  if (!token) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};

const buildRecordResponse = (record, req, authToken = "") => {
  const raw = record.toObject ? record.toObject() : record;
  const recordId = raw._id.toString();
  const baseUrl = getBaseUrl(req);
  const storedFileName = path.basename(raw.fileUrl || "");
  const fileKey = storedFileName || recordId;
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
    ...raw,
    id: recordId,
    recordId,
    fileUrl: raw.fileUrl ? `${baseUrl}${raw.fileUrl}` : "",
    previewUrl,
    downloadUrl
  };
};

const resolveStoredFilePath = (record) => path.join(uploadsDir, path.basename(record.fileUrl || ""));

const findRecordByFileKey = async (fileKey) => {
  const normalizedKey = decodeURIComponent(String(fileKey || "")).trim();

  if (!normalizedKey) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(normalizedKey)) {
    const recordById = await Record.findById(normalizedKey);
    if (recordById) {
      return recordById;
    }
  }

  const safeFileName = path.basename(normalizedKey);
  if (!safeFileName) {
    return null;
  }

  return Record.findOne({
    $or: [{ fileUrl: `/uploads/${safeFileName}` }, { fileName: safeFileName }]
  }).sort({ createdAt: -1 });
};

const isRecordOwnedByUser = (record, userId) => {
  if (!record || !userId) {
    return false;
  }

  const ownerId = record.patientId ? String(record.patientId) : "";
  const altOwnerId = record.userId ? String(record.userId) : "";
  return ownerId === userId || altOwnerId === userId;
};

const uploadRecord = async (req, res) => {
  try {
    const { patientId, title, description } = req.body;
    const authToken = req.authToken || getTokenFromRequest(req);

    if (!patientId || !title) {
      return res.status(400).json({ message: "patientId and title are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "A file is required." });
    }

    const record = await Record.create({
      patientId,
      userId: patientId,
      title,
      description: description || "",
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || "application/octet-stream",
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
    const { patientId } = req.params;
    const search = (req.query.search || req.query.q || "").trim();
    const authToken = req.authToken || getTokenFromRequest(req);

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
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
    const { patientId } = req.params;
    const authToken = req.authToken || getTokenFromRequest(req);

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
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
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    const records = await Record.find(buildPatientFilter(patientId))
      .sort({ createdAt: -1 })
      .select("fileSize createdAt");

    const totalRecords = records.length;
    const totalFileSize = records.reduce((sum, record) => sum + (record.fileSize || 0), 0);
    const lastAddedAt = totalRecords > 0 ? records[0].createdAt : null;

    return res.status(200).json({
      message: "Vault status fetched successfully.",
      status: {
        totalRecords,
        totalFileSize,
        lastAddedAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch vault status.", error: error.message });
  }
};

const previewRecord = async (req, res) => {
  try {
    const fileKey = req.params.filename || req.params.recordId;

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    const record = await findRecordByFileKey(fileKey);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    const filePath = resolveStoredFilePath(record);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Stored file not found." });
    }

    const safeFileName = (record.fileName || path.basename(filePath)).replace(/"/g, "");
    res.setHeader("Content-Type", record.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename=\"${safeFileName}\"`);
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Could not preview record file.", error: error.message });
  }
};

const downloadRecord = async (req, res) => {
  try {
    const fileKey = req.params.filename || req.params.recordId;

    if (!fileKey) {
      return res.status(400).json({ message: "Invalid filename." });
    }

    const record = await findRecordByFileKey(fileKey);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    const filePath = resolveStoredFilePath(record);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Stored file not found." });
    }

    const safeFileName = (record.fileName || path.basename(filePath)).replace(/"/g, "");
    return res.download(filePath, safeFileName);
  } catch (error) {
    return res.status(500).json({ message: "Could not download record file.", error: error.message });
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

    if (!req.user?.id || !mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(401).json({ message: "Invalid user session." });
    }

    const record = await findRecordByFileKey(fileKey);
    if (!record) {
      return res.status(404).json({ message: "Record not found." });
    }

    if (!isRecordOwnedByUser(record, req.user.id)) {
      return res.status(403).json({ message: "You are not allowed to delete this record." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user || !user.password) {
      return res.status(401).json({ message: "User not found." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    const filePath = resolveStoredFilePath(record);
    await Record.deleteOne({ _id: record._id });

    if (fs.existsSync(filePath)) {
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
  deleteRecord
};
