const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const tokenBlacklist = new Set(); 
const { registerValidation, loginValidation } = require("../util/validators");

exports.register = async (req, res) => {
    const { name, surname, email, password } = req.body; 

    const { error } = registerValidation.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ 
            name, 
            surname, 
            email, 
            password: hashedPassword 
        });


        res.status(201).json({
            message: "User registered successfully.",
            userId: user._id,
        });
    } catch (error) {
        console.error("❌ Error in registration:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    const { error } = loginValidation.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" }); 
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });



        res.status(200).json({
            message: "Login successful",
            token,
            userId: user._id,
            profileCompleted: user.profileCompleted,
            name: user.name,
            surname: user.surname,
            email: user.email
        });
    } catch (error) {
        console.error("❌ Error during login:", error);
        res.status(500).json({ message: "Server error" });
    }
};
  
exports.logout = async (req, res) => {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (token) {
        tokenBlacklist.add(token); 
      }
      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("❌ Error during logout:", error);
      res.status(500).json({ message: "Server error" });
    }
  };