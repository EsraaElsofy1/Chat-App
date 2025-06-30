const multer = require('multer'); // Handle file uploads from forms
const sharp = require('sharp'); // Image processing (resize, compress, thumbnails)
const path = require('path'); // Handle file paths and directories
const fs = require('fs'); // File system operations (create, read, delete)
const crypto = require('crypto'); // Generate unique and secure filenames

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/images',
    'uploads/videos',
    'uploads/audio',
    'uploads/documents',
    'uploads/avatars',
    'uploads/temp'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize upload directories
createUploadDirs();

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    'image/jpeg': 'images',
    'image/jpg': 'images',
    'image/png': 'images',
    'image/gif': 'images',
    'image/webp': 'images',
    'video/mp4': 'videos',
    'video/mpeg': 'videos',
    'video/quicktime': 'videos',
    'video/webm': 'videos',
    'audio/mpeg': 'audio',
    'audio/wav': 'audio',
    'audio/ogg': 'audio',
    'audio/mp3': 'audio',
    'application/pdf': 'documents',
    'application/msword': 'documents',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
    'text/plain': 'documents'
  };

  if (allowedTypes[file.mimetype]) {
    file.category = allowedTypes[file.mimetype];
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = file.category || 'documents';
    cb(null, `uploads/${category}`);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${Date.now()}_${uniqueSuffix}_${sanitizedName}${ext}`);
  }
});

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files per request
  }
});

// Image processing middleware
const processImage = async (req, res, next) => {
  if (!req.files && !req.file) {
    return next();
  }

  try {
    const files = req.files || [req.file];
    const processedFiles = [];

    for (const file of files) {
      if (file && file.mimetype.startsWith('image/')) {
        const inputPath = file.path;
        const outputPath = inputPath.replace(/\.[^/.]+$/, '_processed.jpg');
        
        // Process image with sharp
        await sharp(inputPath)
          .resize(1920, 1080, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ 
            quality: 85,
            progressive: true 
          })
          .toFile(outputPath);

        // Create thumbnail
        const thumbnailPath = inputPath.replace(/\.[^/.]+$/, '_thumb.jpg');
        await sharp(inputPath)
          .resize(300, 300, { 
            fit: 'cover' 
          })
          .jpeg({ 
            quality: 80 
          })
          .toFile(thumbnailPath);

        // Update file info
        file.processedPath = outputPath;
        file.thumbnailPath = thumbnailPath;
        file.url = `/uploads/${file.category}/${path.basename(outputPath)}`;
        file.thumbnailUrl = `/uploads/${file.category}/${path.basename(thumbnailPath)}`;

        // Delete original if different from processed
        if (inputPath !== outputPath) {
          fs.unlinkSync(inputPath);
        }
      } else {
        // For non-image files, just set the URL
        file.url = `/uploads/${file.category}/${file.filename}`;
      }

      processedFiles.push({
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl || null,
        category: file.category
      });
    }

    req.processedFiles = processedFiles;
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    next(error);
  }
};

// Avatar upload configuration (smaller size limit)
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/avatars',
    filename: (req, file, cb) => {
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `avatar_${req.user.id}_${uniqueSuffix}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB for avatars
  }
});

// Process avatar images
const processAvatar = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const inputPath = req.file.path;
    const outputPath = inputPath.replace(/\.[^/.]+$/, '_processed.jpg');

    // Process avatar image
    await sharp(inputPath)
      .resize(400, 400, { 
        fit: 'cover' 
      })
      .jpeg({ 
        quality: 90 
      })
      .toFile(outputPath);

    // Create small thumbnail
    const thumbnailPath = inputPath.replace(/\.[^/.]+$/, '_thumb.jpg');
    await sharp(inputPath)
      .resize(100, 100, { 
        fit: 'cover' 
      })
      .jpeg({ 
        quality: 85 
      })
      .toFile(thumbnailPath);

    // Update file info
    req.file.processedPath = outputPath;
    req.file.thumbnailPath = thumbnailPath;
    req.file.url = `/uploads/avatars/${path.basename(outputPath)}`;
    req.file.thumbnailUrl = `/uploads/avatars/${path.basename(thumbnailPath)}`;

    // Delete original
    if (inputPath !== outputPath) {
      fs.unlinkSync(inputPath);
    }

    next();
  } catch (error) {
    console.error('Avatar processing error:', error);
    next(error);
  }
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        maxSize: process.env.MAX_FILE_SIZE || '10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        maxFiles: 5
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field'
      });
    }
  }

  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      error: 'File type not allowed',
      allowedTypes: ['images', 'videos', 'audio', 'documents']
    });
  }

  next(error);
};

// Cleanup function to delete old files
const cleanupOldFiles = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

module.exports = {
  upload,
  processImage,
  avatarUpload,
  processAvatar,
  handleUploadError,
  cleanupOldFiles,
  createUploadDirs
};
