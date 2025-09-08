const Joi = require('joi');

const FREQUENCY_VALUES = [
  'every 1 week', 'every 1 weeks',
  'every 2 week', 'every 2 weeks',
  'every 3 week', 'every 3 weeks',
  'every 1 month', 'every 1 months',
  'every 2 month', 'every 2 months',
  'every 3 month', 'every 3 months',
  'weekly', 'monthly', 'daily', // إضافة أشكال أخرى
  null
];

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
  'Friday', 'Saturday', 'Sunday'
];

const baseHabitSchema = {
  name: Joi.string().required().min(1).max(100)
  .messages({
    'string.empty': 'Habit name cannot be empty',
    'string.min': 'Habit name must be at least {#limit} character',
    'string.max': 'Habit name cannot exceed {#limit} characters',
    'any.required': 'Habit name is required'
  }),
  description: Joi.string().max(500).allow(''),
  type: Joi.string().valid('personal', 'shared').default('personal'),
  startDate: Joi.date().iso()
    .messages({
      'date.base': 'Start date must be a valid date',
      'date.iso': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
  repeat: Joi.string().valid('daily', 'weekly', 'monthly', null).default(null),
  repeatDays: Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK))
    .when('repeat', {
      is: 'weekly',
      then: Joi.array().min(1).required(),
      otherwise: Joi.forbidden().strip()
    }),
  selectedMonthlyDates: Joi.array().items(Joi.string().isoDate())
    .when('repeat', {
      is: 'monthly',
      then: Joi.array().min(1).required(),
      otherwise: Joi.forbidden().strip()
    })
    .messages({
      'array.base': 'Selected monthly dates must be an array',
      'string.isoDate': 'Each selected monthly date must be in ISO format (YYYY-MM-DD)',
      'array.min': 'At least one date must be selected for monthly repetition'
    }),
  reminders: Joi.array().items(Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)),
  frequency: Joi.string().valid(...FREQUENCY_VALUES)
    .when('repeat', {
      is: Joi.valid('weekly', 'monthly'),
      then: Joi.string().required(),
      otherwise: Joi.forbidden().strip()
    }),
  status: Joi.string().valid('active', 'inactive', 'completed', 'pending').default('active'),
  repeatCount: Joi.number().integer().min(1).max(365).allow(null).optional()
  .messages({
    'number.base': 'Repeat count must be a number',
    'number.integer': 'Repeat count must be an integer',
    'number.min': 'Repeat count must be at least {#limit}',
    'number.max': 'Repeat count cannot be more than {#limit}',
    'any.allowOnly': 'Repeat count can be null or a valid integer'
  }),
// Update the reminderOffsets validation to make it truly optional
reminderOffsets: Joi.array()
  .items(Joi.number().integer().min(1).max(5))
  .default([]) // Default empty array
  .optional() // Make the field optional
  .messages({
    'array.base': 'Reminder offsets must be an array if provided',
    'number.min': 'Reminder offset cannot be less than 1 day',
    'number.max': 'Reminder offset cannot be more than 5 days'
  })
};

const sharedHabitFields = {
  ...baseHabitSchema,
  recipient: Joi.string().hex().length(24).required()
    .messages({
      'string.hex': 'Recipient ID must be a valid MongoDB ID',
      'string.length': 'Recipient ID must be 24 characters long',
      'any.required': 'Recipient is required for shared habits'
    }),
  sharedWith: Joi.array().items(Joi.object({
    userId: Joi.string().hex().length(24).required(),
    status: Joi.string().valid('pending', 'accepted', 'rejected', 'left').default('pending'),
    requestedAt: Joi.date(),
    acceptedAt: Joi.date().when('status', {
      is: 'accepted',
      then: Joi.date().required(),
      otherwise: Joi.forbidden()
    }),
    rejectedAt: Joi.date().when('status', {
      is: 'rejected',
      then: Joi.date().required(),
      otherwise: Joi.forbidden()
    })
  })).default([]),
  sharedHabitId: Joi.string().hex().length(24)
};

const createHabitValidation = Joi.object({
  ...baseHabitSchema
}).options({ abortEarly: false });

const createSharedHabitValidation = Joi.object({
  ...sharedHabitFields
}).options({ abortEarly: false });

const updateHabitValidation = Joi.object({
  ...baseHabitSchema,
  name: Joi.string().min(1).max(100),
  description: Joi.string().max(500).allow(''),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null).optional(),
  repeat: Joi.string().valid('daily', 'weekly', 'monthly', null),
  reminders: Joi.array().items(Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)),
  status: Joi.string().valid('active', 'inactive', 'completed', 'pending'),
  frequency: Joi.string().valid(...FREQUENCY_VALUES).allow(null).optional()
    .when('repeat', {
      switch: [
        {
          is: 'weekly',
          then: Joi.string().pattern(/^every [1-3] week(s)?$/).optional()
        },
        {
          is: 'monthly',
          then: Joi.string().pattern(/^every [1-3] month(s)?$/).optional()
        },
        {
          is: Joi.valid('daily', null),
          then: Joi.string().allow(null).optional()
        }
      ]
    }),
  repeatDays: Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK))
    .when('repeat', {
      is: 'weekly',
      then: Joi.array().min(1).required(),
      otherwise: Joi.array().allow(null).optional()
    }),
  selectedMonthlyDates: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      if (/^\d{1,2}$/.test(value)) {
        const dayNum = parseInt(value, 10);
        if (dayNum < 1 || dayNum > 31) {
          return helpers.error('any.invalid', { message: 'Monthly date day number must be between 1 and 31' });
        }
        return value;
      }
      if (isNaN(new Date(value).getTime())) {
        return helpers.error('any.invalid', { message: 'Invalid date format in selectedMonthlyDates' });
      }
      return value;
    })
  ).when('repeat', {
    is: 'monthly',
    then: Joi.array().min(1).required(),
    otherwise: Joi.array().allow(null).optional() 
  }),
repeatCount: Joi.when('repeat', {
  is: Joi.string().valid('daily', 'weekly', 'monthly'),
  then: Joi.number().integer().min(1).max(365).optional()
    .messages({
      'number.base': 'Repeat count must be a number',
      'number.integer': 'Repeat count must be an integer',
      'number.min': 'Repeat count must be at least {#limit}',
      'number.max': 'Repeat count cannot be more than {#limit}'
    }),
  otherwise: Joi.number().optional().allow(null).strip()
}),
}).min(1)
.messages({
  'object.min': 'At least one field must be provided for an update.'
})
.options({ abortEarly: false });

module.exports = {
  createHabitValidation,
  createSharedHabitValidation,
  updateHabitValidation,
  FREQUENCY_VALUES
};