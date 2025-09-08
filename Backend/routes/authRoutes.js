const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const { getUserProfile } = require("../controllers/meController");
const { register, login, logout } = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middleware/userMiddleware");

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/logout", authenticate,logout);
router.get("/me", authenticate, getUserProfile);


module.exports = router;



