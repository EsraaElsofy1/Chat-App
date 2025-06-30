const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const { authenticateToken } = require("../middleware/auth");
const { 
  upload, 
  processImage, 
  avatarUpload, 
  processAvatar, 
  handleUploadError 
} = require("../middleware/upload");

// Apply authentication to all upload routes
router.use(authenticateToken);

// Upload multiple files for messages
router.post(
  "/files",
  upload.array('files', 5), // Maximum 5 files
  processImage,
  handleUploadError,
  uploadController.uploadFiles
);

// Upload single file
router.post(
  "/file",
  upload.single('file'),
  processImage,
  handleUploadError,
  uploadController.uploadFiles
);

// Upload avatar
router.post(
  "/avatar",
  avatarUpload.single('avatar'),
  processAvatar,
  handleUploadError,
  uploadController.uploadAvatar
);

// Validate file before upload
router.post("/validate", uploadController.validateFile);

// Get file information
router.get("/file/:filename", uploadController.getFileInfo);

// Delete file
router.delete("/file/:filename", uploadController.deleteFile);

// Get user's uploaded files
router.get("/user-files", uploadController.getUserFiles);

// Get upload statistics (admin or user stats)
router.get("/stats", uploadController.getUploadStats);

// Error handling middleware
router.use(handleUploadError);

module.exports = router;
