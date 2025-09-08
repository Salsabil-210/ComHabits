const User = require("../models/UserModel");

exports.getUserProfile = async (req, res) => {
    try {
      // Double-check userId existence
      if (!req.userId) {
        return res.status(401).json({ message: "User ID missing. Are you logged in?" });
      }
  
      const user = await User.findById(req.userId).select("-password");
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
  
      res.status(200).json({ user });
    } catch (error) {
      console.error("❌ Profile fetch error:", error);
      res.status(500).json({ message: "Server error." });
    }
  };