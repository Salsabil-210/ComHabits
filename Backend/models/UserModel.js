const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"]
    },
    surname: {
        type: String,
        default: null
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: 6
    },
    profileCompleted: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profilePicture: {
        type: String,
        default: null
    },
    resetPasswordCode: {
        type: String,
        default: null
    },
    resetPasswordCodeExpires: {
        type: Date,
        default: null
    },
    // a reference to the `Habit` model so a user can have multiple habits
    habits: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Habit" 
    }]
}, { timestamps: true });

// Hash the password before saving, but only if it's new or modified
userSchema.pre("save", async function (next) {
    if (this.isModified("password") && !this.password.startsWith("$2b$")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Compare password for login authentication
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

