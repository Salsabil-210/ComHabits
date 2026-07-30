const authService = require("../services/authService");

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      message: "User registered successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const accessToken = req.token || req.header("Authorization")?.replace("Bearer ", "");
    const { refreshToken } = req.body || {};
    const userId = req.userId;

    const result = await authService.logout(accessToken, refreshToken, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.status(200).json({
      message: "Tokens refreshed successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};