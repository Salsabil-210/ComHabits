const { registerValidation, loginValidation } = require("../util/validators");

const validateRegister = (req, res, next) => {
    const { error } = registerValidation.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

const validateLogin = (req, res, next) => {
    //console.log("✅ Running validateLogin middleware...");
    //console.log("Request Body:", req.body);
    //console.log("loginValidation Schema:", loginValidation); // ✅ تحقق مما إذا كان `loginValidation` معرفًا

    const { error } = loginValidation.validate(req.body); // ✅ هنا يتم التحقق من المدخلات
    if (error) {
        console.log("❌ Validation Error:", error.details[0].message);
        return res.status(400).json({ message: error.details[0].message });
    }

    next();
};

module.exports = { validateRegister, validateLogin };
