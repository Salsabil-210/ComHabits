const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const habitController = require("../controllers/habitController");
const sharedHabitController = require("../controllers/sharedHabitController");
const { validateHabit } = require("../middleware/habitMiddleware");

// Personal Habit Routes
router.post("/", authenticate, validateHabit, habitController.createHabit);
router.get("/", authenticate, habitController.getHabits);
router.get("/stats", authenticate, habitController.getHabitStats);
router.put("/:habitId", authenticate,validateHabit, habitController.updateHabit);
router.delete("/:habitId", authenticate, habitController.deleteHabit);
router.post("/:habitId/track", authenticate, habitController.trackHabit);
router.get("/by-date-range", authenticate, habitController.getHabitsByDateRange);
router.delete("/:habitId/occurrence", authenticate, habitController.deleteSingleHabitOccurrence);
// Shared Habit Routes
router.post("/shared/request", authenticate, validateHabit, sharedHabitController.createSharedHabitRequest);
router.post("/shared/:habitId/accept", authenticate, sharedHabitController.acceptSharedHabit);
router.post("/shared/:habitId/reject", authenticate, sharedHabitController.rejectSharedHabit);
router.get("/shared", authenticate, sharedHabitController.getSharedHabits);
router.post("/shared/:habitId/track", authenticate, sharedHabitController.trackSharedHabit);
router.get("/shared/:habitId/progress", authenticate, sharedHabitController.getSharedHabitProgress);
router.put("/shared/:habitId/update",authenticate,sharedHabitController.updateSharedHabit);
router.delete("/shared/:habitId/delete",authenticate,sharedHabitController.deleteSharedHabit);
module.exports = router;