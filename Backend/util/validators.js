const Joi = require("joi");

const validateEmail = (email) => {
    const schema = Joi.string()
        .email({ tlds: { allow: false } })
        .pattern(/^[^\s@]+@[^\s@]+\.com$/) // Must end with .com and no spaces
        .required()
        .messages({
            "string.email": "Invalid email format",
            "string.pattern.base": "Email must end with .com and contain no spaces",
            "any.required": "Email is required",
        });

    const { error } = schema.validate(email);
    return error ? error.details[0].message : null;
};

const strictPasswordSchema = Joi.string()
  .pattern(/^(?=.*[A-Za-z])[A-Za-z\d\W]{6,20}$/)
  .required()
  .messages({
    "string.pattern.base": "Password must be 6-20 characters, contain at least one letter, and not be only digits or symbols.",
    "any.required": "Password is required"
  });

const validatePassword = (password) => {
  const { error } = strictPasswordSchema.validate(password);
  return error ? error.details[0].message : null; // Return error message or null if valid
};

// ✅ التحقق من رمز إعادة تعيين كلمة المرور (يجب أن يكون 6 أرقام فقط)
const validateResetToken = (token) => {
    const schema = Joi.string().length(6).pattern(/^[0-9]{6}$/).required();
    const { error } = schema.validate(token);
    return !error; // This one stays boolean since it's used differently
};

// ✅ Registration Validation Schema
const registerValidation = Joi.object({
    name: Joi.string()
        .min(3)
        .max(30)
        .pattern(/^\S+$/) // No spaces allowed
        .required()
        .messages({
            "string.empty": "Name is required",
            "string.min": "Name must be at least 3 characters",
            "string.max": "Name must be less than 30 characters",
            "string.pattern.base": "Name cannot contain spaces",
            "any.required": "Name is required",
        }),
    surname: Joi.string()
        .min(3)
        .max(30)
        .pattern(/^\S+$/) // No spaces allowed
        .required()
        .messages({
            "string.empty": "Surname is required",
            "string.min": "Surname must be at least 3 characters",
            "string.max": "Surname must be less than 30 characters",
            "string.pattern.base": "Surname cannot contain spaces",
            "any.required": "Surname is required",
        }),
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) // Prevent spaces
        .pattern(/\.com$/) // Must end with .com
        .required()
        .messages({
            "string.email": "Invalid email format",
            "string.pattern.base": "Email must be a valid format and end with .com",
            "any.required": "Email is required",
        }),
     password: Joi.string()
      .pattern(/^(?=.*[A-Za-z])[A-Za-z\d\W]{6,20}$/)
      .required()
      .messages({
        "string.pattern.base": "Password must be 6-20 characters, contain at least one letter, and not be only digits or symbols.",
        "any.required": "Password is required"
      }),
});

// ✅ Login Validation Schema
const loginValidation = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) // Prevent spaces
        .pattern(/\.com$/) // Must end with .com
        .required()
        .messages({
            "string.email": "Invalid email format",
            "string.pattern.base": "Email must be a valid format and end with .com",
            "any.required": "Email is required",
        }),
    password: Joi.string()
        .pattern(/^\S+$/) // No spaces allowed
        .required()
        .messages({
            "any.required": "Password is required",
        }),
});

// ✅ Export Validators
module.exports = {
    registerValidation,
    loginValidation,
    validateEmail,
    validatePassword,
    validateResetToken,
    strictPasswordSchema,
};

