const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { protect } = require("../middleware/authMiddleware");
const { uploadRecord, getRecordsByPatientId } = require("../controllers/recordController");

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
router.get("/:patientId", protect, getRecordsByPatientId);

module.exports = router;
