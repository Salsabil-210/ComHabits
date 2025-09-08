const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const nodemailer = require("nodemailer");
const { validateEmail, validatePassword, validateResetToken } = require("../util/validators");
require("dotenv").config();

// Regex: 6-8 characters, must contain letters, and not only digits or only symbols
const strictPasswordRegex = /^(?=.*[A-Za-z])[A-Za-z\d\W]{6,20}$/;
// إرسال كود رقمي إلى البريد الإلكتروني
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: "If this email exists, a reset code was sent." });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = Date.now() + 5 * 60 * 1000; // 5 دقائق
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.FROM_EMAIL, 
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Your Password Reset Code",
      html: `<p>Your reset code is:</p><h2>${resetCode}</h2><p>Please don't share it with anyone!!This code will expire in 5 minutes.</p>`
    });

    res.status(200).json({ message: "Reset code sent to your email." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// التحقق من كود الاسترجاع فقط
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (!validateResetToken(code)) {
      return res.status(400).json({ message: "Invalid reset code format" });
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordCode || !user.resetPasswordCodeExpires) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (Date.now() > user.resetPasswordCodeExpires) {
      return res.status(400).json({ message: "Code has expired" });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    res.status(200).json({ message: "Code verified successfully." });
  } catch (error) {
    console.error("Verify Code Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// تعيين كلمة مرور جديدة بعد التحقق
exports.setNewPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (!validateResetToken(code)) {
      return res.status(400).json({ message: "Invalid reset code format" });
    }

    if (!strictPasswordRegex.test(newPassword)) {
      return res.status(400).json({
      message: "Password must be 6-20 characters, contain at least one letter, and not be only digits or symbols."
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.resetPasswordCode || !user.resetPasswordCodeExpires) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    if (Date.now() > user.resetPasswordCodeExpires) {
      return res.status(400).json({ message: "Code has expired" });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ message: "Invalid code" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = null;
    user.resetPasswordCodeExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Set Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};