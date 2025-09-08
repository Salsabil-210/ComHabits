const express = require('express');
const router = express.Router();
const {
  getQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
  updatePreferences
} = require('../controllers/motivationalController');
const { authenticateUser } = require('../middleware/authMiddleware');
const { validateQuote, validatePreferences } = require('../validators/motivationalValidators');

// Motivational Quotes CRUD
router.get('/quotes', authenticateUser, getQuotes);         
router.post('/quotes', authenticateUser, validateQuote, createQuote);  
router.put('/quotes/:id', authenticateUser, validateQuote, updateQuote); 
router.delete('/quotes/:id', authenticateUser, deleteQuote); 

// User Preferences for Quotes
router.put('/preferences/:userId', authenticateUser, validatePreferences, updatePreferences); 

module.exports = router;