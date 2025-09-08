const express = require("express");
const router = express.Router();
const { forgotPassword, verifyResetCode, setNewPassword } = require("../controllers/passwordResetController");

// Remove "password-reset/" prefix
router.post("/forgot-password", forgotPassword);
router.post("/verify-code", verifyResetCode);
router.post("/reset-password", setNewPassword);

module.exports = router;