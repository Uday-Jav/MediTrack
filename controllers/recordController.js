const mongoose = require("mongoose");
const Record = require("../models/Record");

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
      fileUrl: `/uploads/${req.file.filename}`
    });

    return res.status(201).json({
      message: "Medical record uploaded successfully.",
      record
    });
  } catch (error) {
    return res.status(500).json({ message: "Record upload failed.", error: error.message });
  }
};

const getRecordsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patientId." });
    }

    const records = await Record.find({
      $or: [{ patientId }, { userId: patientId }]
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Medical history fetched successfully.",
      count: records.length,
      records
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not fetch records.", error: error.message });
  }
};

module.exports = {
  uploadRecord,
  getRecordsByPatientId
};
