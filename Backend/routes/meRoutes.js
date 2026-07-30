const express = require("express");
const { getUserProfile } = require("../controllers/meController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/profile", authMiddleware, getUserProfile);

module.exports = router;
