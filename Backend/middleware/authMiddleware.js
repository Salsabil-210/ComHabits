const jwt = require("jsonwebtoken");
const authConfig = require("../config/auth");
const redis = require("../util/redis");

const authenticate = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        // Check if token is blacklisted in Redis
        const isRevoked = await redis.get(`blacklist:${token}`);
        if (isRevoked) {
            return res.status(401).json({ message: "Token has been revoked." });
        }

        const decoded = jwt.verify(token, authConfig.jwt.secret);

        req.userId = decoded.id;
        req.user = { _id: decoded.id };
        req.token = token;

        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
};

module.exports = authenticate;
