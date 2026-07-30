const Joi = require("joi");

const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  },
  refreshToken: {
    maxAgeDays: parseInt(process.env.REFRESH_MAX_AGE_DAYS, 10) || 7,
  },
};

const schema = Joi.object({
  jwt: Joi.object({
    secret: Joi.string().min(32).required(),
    accessExpiresIn: Joi.string().required(),
    refreshExpiresIn: Joi.string().required(),
  }).required(),
  bcrypt: Joi.object({
    saltRounds: Joi.number().integer().min(10).max(20).required(),
  }).required(),
  refreshToken: Joi.object({
    maxAgeDays: Joi.number().integer().min(1).max(365).required(),
  }).required(),
}).required();

const { error } = schema.validate(authConfig);
if (error) {
  throw new Error(`Auth config validation error: ${error.message}`);
}

module.exports = authConfig;
