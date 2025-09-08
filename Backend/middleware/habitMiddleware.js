const {
  createHabitValidation,
  createSharedHabitValidation,
  updateHabitValidation,
} = require("../util/habitValidators");

const validateHabit = (req, res, next) => {
  try {
    let schema;
    if (req.method === "POST") {
      schema = req.originalUrl.includes("/shared/") 
        ? createSharedHabitValidation 
        : createHabitValidation;
    } else {
      schema = updateHabitValidation;
    }

    // Validate request body
    const { error } = schema.validate(req.body, { 
      abortEarly: false,
      allowUnknown: false // Reject unknown fields
    });

    if (error) {
      const errorMessages = error.details.map((d) => d.message).join(", ");
      return res.status(400).json({ 
        message: "Validation error",
        errors: errorMessages,
        code: "VALIDATION_ERROR"
      });
    }

    // Additional date validation
    if (req.body.startDate || req.body.endDate) {
      const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
      const endDate = req.body.endDate ? new Date(req.body.endDate) : null;

      if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid start date format",
          code: "INVALID_START_DATE"
        });
      }

      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid end date format",
          code: "INVALID_END_DATE"
        });
      }

      if (startDate && endDate && endDate <= startDate) {
        return res.status(400).json({ 
          message: "End date must be after start date",
          code: "DATE_ORDER_INVALID"
        });
      }
    }

    // For shared habits, verify friendId exists
    if (req.body.friendId && req.method === "POST") {
      // You might want to add actual database check here
      if (!/^[0-9a-fA-F]{24}$/.test(req.body.friendId)) {
        return res.status(400).json({
          message: "Invalid friend ID format",
          code: "INVALID_FRIEND_ID"
        });
      }
    }

    next();
  } catch (err) {
    console.error("[validateHabit] Middleware error:", err);
    res.status(500).json({ 
      message: "Internal validation error",
      code: "INTERNAL_VALIDATION_ERROR"
    });
  }
};

module.exports = { validateHabit };