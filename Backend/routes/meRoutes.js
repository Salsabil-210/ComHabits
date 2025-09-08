const express = require("express");
const { getUserProfile } = require("../controllers/meController");
const authMiddleware = require("../middleware/authMiddleware"); // Ensure authentication

const router = express.Router();

router.get("/profile", authMiddleware, getUserProfile); // Protect the route with authentication

module.exports = router;
