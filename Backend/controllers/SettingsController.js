const User = require('../models/UserModel');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { validateEmail, validatePassword } = require('../util/validators');
const uploadsConfig = require('../config/uploads');

// Update the uploadProfilePicture method
exports.uploadProfilePicture = async (req, res) => {
  try {
    // Check authentication
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    // Check if file is present
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded or file format not supported"
      });
    }

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Define paths
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    const tempPath = req.file.path;
    const newFilename = `profile-${req.userId}${path.extname(req.file.originalname)}`;
    const targetPath = path.join(uploadsDir, newFilename);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move file from temp to permanent location
    fs.renameSync(tempPath, targetPath);

    // Delete old image if exists
    if (user.profilePicture) {
      try {
        const oldPath = path.join(uploadsDir, path.basename(user.profilePicture));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
      }
    }

    // Update user with new profile picture URL
    user.profilePicture = `/uploads/${newFilename}`;
    await user.save();

    return res.status(200).json({
      success: true,
      profilePicture: user.profilePicture,
      message: 'Profile picture uploaded successfully'
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.deleteProfilePicture = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).send("Not authenticated");

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).send("User not found");    if (!user.profilePicture) return res.status(400).send("No profile picture to delete");    const profilePicsDir = uploadsConfig.getProfilePicturePath();
    const filename = user.profilePicture.split('/').pop();
    const imagePath = path.join(profilePicsDir, filename);
    
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Continue even if file delete fails - we still want to remove the reference from the user
    }

    user.profilePicture = null;
    await user.save();

    res.status(200).json({ success: true, message: 'Profile picture deleted' });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).send("Failed to delete profile picture");
  }
};

exports.updateUser = async (req, res) => {
  try {
    console.log('Update user request received:', {
      body: req.body,
      userId: req.userId
    });

    const { name, surname, email } = req.body;

    if (!req.userId) {
      console.log('Unauthorized - no userId');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.'
      });
    }

    // Find user
    const user = await User.findById(req.userId);
    if (!user) {
      console.log('User not found with ID:', req.userId);
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    console.log('Current user data:', {
      currentName: user.name,
      currentSurname: user.surname,
      currentEmail: user.email
    });

    console.log('Update data:', {
      newName: name,
      newSurname: surname,
      newEmail: email
    });

    // Validate and check for email uniqueness if changing email
    if (typeof email === "string" && email !== user.email) {
      console.log('Email is being changed');
      const emailError = validateEmail(email);
      if (emailError) {
        console.log('Email validation failed:', emailError);
        return res.status(400).json({
          success: false,
          message: emailError
        });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.userId) {
        console.log('Email already in use by another user');
        return res.status(400).json({
          success: false,
          message: 'Email already in use.'
        });
      }
      user.email = email;
    }

    // Update user fields
    if (typeof name === "string") {
      console.log('Updating name from', user.name, 'to', name);
      user.name = name;
    }
    if (typeof surname === "string") {
      console.log('Updating surname from', user.surname, 'to', surname);
      user.surname = surname;
    }

    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: {
        name: user.name,
        surname: user.surname,
        email: user.email,
        _id: user._id
      }
    });
  } catch (error) {
    console.error('Error in updateUser:', {
      message: error.message,
      stack: error.stack,
      fullError: error
    });
    return res.status(500).json({
      success: false,
      message: 'Error updating user.',
      error: error.message
    });
  }
};

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  if (!validatePassword(newPassword)) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long."
    });
  }

  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated."
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Old password is incorrect."
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const badhabit =require('../models/BadHabitModel');
const habit= require('../models/HabitModel');
const distractions= require('../models/distractionModel');
const friend =require('../models/FriendModel');
const sharedhabit=require('../models/HabitModel');
const notifications=require('../models/NotificationModel');

exports.deleteAccount = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated."
      });
    }

   
     await badhabit.deleteMany({ userId: req.userId });
     await habit.deleteMany({ userId: req.userId });
     await distractions.deleteMany({ userId: req.userId });
     await friend.deleteMany({ userId: req.userId });
     await sharedhabit.deleteMany({ userId: req.userId });
     await notifications.deleteMany({ userId: req.userId });
     
    const user = await User.findByIdAndDelete(req.userId);
          if (!user) {
           return res.status(404).json({
        success: false,
        message: "User not found."
      });
     }
     
    res.json({
      success: true,
      message: 'Account deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getProfilePicture = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated" 
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    if (!user.profilePicture) {
      return res.status(404).json({
        success: false,
        message: "No profile picture found"
      });
    }

    // Return the profile picture URL
    return res.status(200).json({
      success: true,
      profilePicture: user.profilePicture
    });

  } catch (error) {
    console.error("Get profile picture error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get profile picture",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// Add this new method to get user info
exports.getUserInfo = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });
    }

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        surname: user.surname,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user information"
    });
  }
};