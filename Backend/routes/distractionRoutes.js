const express = require('express');
const router = express.Router();
const distractionController = require('../controllers/distractionController');
const { 
  distractionValidators,
  getDistractionsValidator,
  editDistractionValidator,
  deleteDistractionValidator
} = require('../util/distractionValidator');
const authenticate = require('../middleware/authMiddleware');
const distractionMiddleware = require('../middleware/distractionMiddleware');

router.post('/log', 
  authenticate,
  distractionValidators,
  distractionMiddleware.handleValidationErrors,
  distractionMiddleware.autoFillDescription,
  distractionController.logDistraction
);

router.get('/logs', 
  authenticate,
  getDistractionsValidator,
  distractionController.getDistractions
);


router.put('/edit/:id', 
  authenticate,
  editDistractionValidator,
  distractionController.updateDistraction
);

router.delete('/delete/:id', 
  authenticate,
  deleteDistractionValidator,
  distractionController.deleteDistraction
);


router.get('/counts', 
  authenticate,
  distractionController.getDistractionCounts
);

module.exports = router;