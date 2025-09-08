const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const settingsController = require('../controllers/SettingsController');

// Ensure uploads directory exists
const uploadsConfig = require('../config/uploads');

// Initialize directory structure
const baseDir = uploadsConfig.baseDir;
const profilePicsDir = uploadsConfig.getProfilePicturePath();
const tempUploadDir = path.join(baseDir, 'temp');

// Create all required directories
[baseDir, profilePicsDir, tempUploadDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

router.put('/update', authMiddleware, settingsController.updateUser);
router.put('/change-password', authMiddleware, settingsController.changePassword);
router.delete('/delete-account', authMiddleware, settingsController.deleteAccount);
router.post('/profile-picture', authMiddleware, upload.single('profilePicture'), settingsController.uploadProfilePicture);
router.delete('/profile-picture', authMiddleware, settingsController.deleteProfilePicture);
router.get('/get-profile-picture', authMiddleware, settingsController.getProfilePicture);
router.get('/user-info', authMiddleware, settingsController.getUserInfo);

module.exports = router;
