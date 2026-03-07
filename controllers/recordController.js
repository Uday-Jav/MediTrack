const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Record = require("../models/Record");

const uploadsDir = path.join(__dirname, "..", "uploads");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getBaseUrl = (req) => `${req.protocol}://${req.get("host")}`;

const buildPatientFilter = (patientId) => ({
  $or: [{ patientId }, { userId: patientId }]
});

const buildRecordResponse = (record, req) => {
  const raw = record.toObject ? record.toObject() : record;
  const recordId = raw._id.toString();
  const baseUrl = getBaseUrl(req);

  return {
    ...raw,
    id: recordId,
    recordId,
    fileUrl: raw.fileUrl ? `${baseUrl}${raw.fileUrl}` : "",
    previewUrl: `${baseUrl}/api/records/file/${recordId}/preview`,
    downloadUrl: `${baseUrl}/api/records/file/${recordId}/download`
  };
};

const resolveStoredFilePath = (record) => path.join(uploadsDir, path.basename(record.fileUrl || ""));

const uploadRecord = async (req, res) => {
  try {
    const { patientId, title, description } = req.body;

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
      record: buildRecordResponse(record, req)
    });
  } catch (error) {
    return res.status(500).json({ message: "Record upload failed.", error: error.message });
  }
};

const getRecordsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;
    const search = (req.query.search || req.query.q || "").trim();

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
      records: records.map((record) => buildRecordResponse(record, req))
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch records.", error: error.message });
  }
};

const getRecentRecords = async (req, res) => {
  try {
    const { patientId } = req.params;

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
      records: records.map((record) => buildRecordResponse(record, req))
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
    const { recordId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return res.status(400).json({ message: "Invalid recordId." });
    }

    const record = await Record.findById(recordId);
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
    const { recordId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return res.status(400).json({ message: "Invalid recordId." });
    }

    const record = await Record.findById(recordId);
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

module.exports = {
  uploadRecord,
  getRecordsByPatientId,
  getRecentRecords,
  getVaultStatus,
  previewRecord,
  downloadRecord
};
