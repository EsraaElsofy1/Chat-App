const User = require("../models/user");
const { cleanupOldFiles } = require("../middleware/upload");
const path = require('path');
const fs = require('fs');

// Upload multiple files for messages
const uploadFiles = async (req, res) => {
  try {
    if (!req.processedFiles || req.processedFiles.length === 0) {
      return res.status(400).json({
        error: "No files uploaded"
      });
    }

    // Return file information
    res.json({
      message: "Files uploaded successfully",
      files: req.processedFiles.map(file => ({
        originalName: file.originalName,
        filename: file.filename,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        size: file.size,
        type: file.category,
        mimetype: file.mimetype
      }))
    });

  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      error: "Internal server error during file upload"
    });
  }
};

// Upload avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No avatar file uploaded"
      });
    }

    const user = req.user;
    
    // Delete old avatar if exists
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      cleanupOldFiles(oldAvatarPath);
      
      // Also delete thumbnail
      const oldThumbnailPath = oldAvatarPath.replace('_processed.jpg', '_thumb.jpg');
      cleanupOldFiles(oldThumbnailPath);
    }

    // Update user avatar
    user.avatar = req.file.url;
    await user.save();

    res.json({
      message: "Avatar uploaded successfully",
      avatar: {
        url: req.file.url,
        thumbnailUrl: req.file.thumbnailUrl
      },
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({
      error: "Internal server error during avatar upload"
    });
  }
};

// Get file info
const getFileInfo = async (req, res) => {
  try {
    const { filename } = req.params;
    const { category = 'documents' } = req.query;
    
    const filePath = path.join(__dirname, '..', 'uploads', category, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "File not found"
      });
    }

    const stats = fs.statSync(filePath);
    const fileInfo = {
      filename,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      url: `/uploads/${category}/${filename}`
    };

    res.json(fileInfo);

  } catch (error) {
    console.error("Get file info error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

// Delete file
const deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { category = 'documents' } = req.query;
    
    const filePath = path.join(__dirname, '..', 'uploads', category, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: "File not found"
      });
    }

    // Delete main file
    fs.unlinkSync(filePath);
    
    // Delete thumbnail if exists
    const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    res.json({
      message: "File deleted successfully"
    });

  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      error: "Internal server error during file deletion"
    });
  }
};

// Get user's uploaded files
const getUserFiles = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category, page = 1, limit = 20 } = req.query;
    
    // This would require storing file metadata in database
    // For now, we'll return a simple response
    res.json({
      message: "Feature coming soon - file history tracking",
      userId,
      category,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error("Get user files error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

// Validate file before upload
const validateFile = (req, res) => {
  const { filename, size, type } = req.body;
  
  if (!filename || !size || !type) {
    return res.status(400).json({
      error: "Missing file information"
    });
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
  
  if (size > maxSize) {
    return res.status(400).json({
      error: "File too large",
      maxSize: maxSize,
      currentSize: size
    });
  }

  const allowedTypes = ['image', 'video', 'audio', 'document'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: "File type not allowed",
      allowedTypes
    });
  }

  res.json({
    valid: true,
    message: "File validation passed"
  });
};

// Get upload statistics
const getUploadStats = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    const categories = ['images', 'videos', 'audio', 'documents', 'avatars'];
    
    const stats = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const category of categories) {
      const categoryPath = path.join(uploadDir, category);
      
      if (fs.existsSync(categoryPath)) {
        const files = fs.readdirSync(categoryPath);
        let categorySize = 0;
        
        files.forEach(file => {
          const filePath = path.join(categoryPath, file);
          const fileStats = fs.statSync(filePath);
          categorySize += fileStats.size;
        });
        
        stats[category] = {
          count: files.length,
          size: categorySize
        };
        
        totalFiles += files.length;
        totalSize += categorySize;
      } else {
        stats[category] = {
          count: 0,
          size: 0
        };
      }
    }

    res.json({
      totalFiles,
      totalSize,
      categories: stats,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
    });

  } catch (error) {
    console.error("Get upload stats error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

module.exports = {
  uploadFiles,
  uploadAvatar,
  getFileInfo,
  deleteFile,
  getUserFiles,
  validateFile,
  getUploadStats
};
