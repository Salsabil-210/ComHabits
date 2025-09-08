const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

const autoFillDescription = (req, res, next) => {
  if (req.body.category && !req.body.description) {
    const descriptions = {
      'Social Media': 'Time spent scrolling social media',
      'Environment': 'Noisy or distracting environment',
      'Health': 'Physical or mental health issue',
      'Mood': 'Emotional state affecting focus',
      'Lack of Time': 'Not enough time to focus',
      'Other': 'Unspecified distraction'
    };
    req.body.description = descriptions[req.body.category] || 'Distraction occurred';
  }
  next();
};

module.exports = {
  handleValidationErrors,
  autoFillDescription
};