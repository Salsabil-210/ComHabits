const { body, query, param } = require('express-validator');

const categories = [
  'Social Media',
  'Environment',
  'Health',
  'Mood',
  'Lack of Time',
  'Other'
];

const distractionValidators = [
  body('category')
    .isIn(categories)
    .withMessage(`Category must be one of: ${categories.join(', ')}`),
  body('severity')
    .isInt({ min: 1, max: 5 })
    .withMessage('Severity must be between 1-5'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Description must be < 500 chars')
];

const getDistractionsValidator = [
  query('timeframe')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Invalid timeframe')
];

const editDistractionValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  ...distractionValidators.map(validation => validation.optional())
];

const deleteDistractionValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format')
];

module.exports = {
  distractionValidators,
  getDistractionsValidator,
  editDistractionValidator,
  deleteDistractionValidator
};