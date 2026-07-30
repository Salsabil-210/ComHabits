const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const authConfig = require("../config/auth");
const userRepository = require("../repositories/userRepository");
const redis = require("../util/redis");
const { ValidationError, UnauthorizedError, ConflictError } = require("../util/errors");

class AuthService {
  #generateTokens(userId) {
    const accessToken = jwt.sign({ id: userId, type: "access" }, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.accessExpiresIn,
    });

    const refreshToken = jwt.sign({ id: userId, type: "refresh" }, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  async #hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async register({ name, surname, email, password }) {
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      throw new ConflictError("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(password, authConfig.bcrypt.saltRounds);

    const user = await userRepository.create({
      name: name.trim(),
      surname: surname ? surname.trim() : null,
      email: cleanEmail,
      password: hashedPassword,
      profileCompleted: false,
    });

    const { accessToken, refreshToken } = this.#generateTokens(user._id);

    // Store refresh token hash in Redis (whitelist approach)
    const refreshHash = await this.#hashToken(refreshToken);
    await redis.setex(
      `refresh:${user._id}:${refreshHash}`,
      authConfig.refreshToken.maxAgeDays * 86400,
      "valid"
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        profileCompleted: user.profileCompleted,
      },
      accessToken,
      refreshToken,
    };
  }

  async login({ email, password }) {
    const cleanEmail = email.toLowerCase().trim();

    const user = await userRepository.findByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const { accessToken, refreshToken } = this.#generateTokens(user._id);

    const refreshHash = await this.#hashToken(refreshToken);
    await redis.setex(
      `refresh:${user._id}:${refreshHash}`,
      authConfig.refreshToken.maxAgeDays * 86400,
      "valid"
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        profileCompleted: user.profileCompleted,
      },
      accessToken,
      refreshToken,
    };
  }

  async logout(accessToken, refreshToken, userId) {
    // Blacklist access token (until it expires)
    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`blacklist:${accessToken}`, ttl, "revoked");
        }
      }
    }

    // Remove refresh token from whitelist
    if (refreshToken) {
      const refreshHash = await this.#hashToken(refreshToken);
      await redis.del(`refresh:${userId}:${refreshHash}`);
    }

    return { message: "Logout successful" };
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token required");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, authConfig.jwt.secret);
    } catch {
      throw new UnauthorizedError("Invalid refresh token");
    }

    if (decoded.type !== "refresh") {
      throw new UnauthorizedError("Invalid token type");
    }

    // Verify token exists in whitelist
    const refreshHash = await this.#hashToken(refreshToken);
    const exists = await redis.get(`refresh:${decoded.id}:${refreshHash}`);

    if (!exists) {
      throw new UnauthorizedError("Refresh token revoked");
    }

    // Rotate: delete old refresh token, issue new one
    await redis.del(`refresh:${decoded.id}:${refreshHash}`);

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    const tokens = this.#generateTokens(user._id);
    const newRefreshHash = await this.#hashToken(tokens.refreshToken);

    await redis.setex(
      `refresh:${user._id}:${newRefreshHash}`,
      authConfig.refreshToken.maxAgeDays * 86400,
      "valid"
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        profileCompleted: user.profileCompleted,
      },
      ...tokens,
    };
  }
}

module.exports = new AuthService();
