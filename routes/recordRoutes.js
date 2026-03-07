const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { protect } = require("../middleware/authMiddleware");
const {
  uploadRecord,
  getRecordsByPatientId,
  getRecentRecords,
  getVaultStatus,
  previewRecord,
  downloadRecord,
  deleteRecord
} = require("../controllers/recordController");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post("/upload", protect, upload.single("file"), uploadRecord);
router.get("/file/:filename/preview", protect, previewRecord);
router.get("/file/:filename/download", protect, downloadRecord);
router.delete("/file/:filename", protect, deleteRecord);
router.get("/:patientId/recent", protect, getRecentRecords);
router.get("/:patientId/vault-status", protect, getVaultStatus);
router.get("/:patientId", protect, getRecordsByPatientId);

module.exports = router;
