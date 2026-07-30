const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimiter");
const { getUserProfile } = require("../controllers/meController");
const { register, login, logout, refresh } = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middleware/userMiddleware");

router.post("/register", authLimiter, validateRegister, register);
router.post("/login", authLimiter, validateLogin, login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getUserProfile);

module.exports = router;
