const multer = require('multer');
const path = require('path');

// Keep files in memory and stream directly to Cloudinary.
const storage = multer.memoryStorage();

// File filter - only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024 // 8MB max file size
  },
  fileFilter
});

module.exports = upload;
