const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const BadHabitController = require('../controllers/BadHabitController');

router.get('/getbadhabits', authenticate, BadHabitController.getHabits);
router.post('/addbadhabit', authenticate, BadHabitController.addHabit);
router.put('/updatebadhabit/:id', authenticate, BadHabitController.updateHabit);
router.delete('/deletebadhabit/:id', authenticate, BadHabitController.deleteHabit);
router.post('/:id/track', authenticate, BadHabitController.toggleComplete);

module.exports = router;