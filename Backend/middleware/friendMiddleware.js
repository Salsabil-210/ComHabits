const { sendFriendRequestValidation, respondToFriendRequestValidation, removeFriendValidation } = require("../util/friendValidators");

const validateSendFriendRequest = (req, res, next) => {
    const { error } = sendFriendRequestValidation.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

const validateRespondToFriendRequest = (req, res, next) => {
    const { error } = respondToFriendRequestValidation.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

const validateRemoveFriend = (req, res, next) => {
    const { error } = removeFriendValidation.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    next();
};

module.exports = { validateSendFriendRequest, validateRespondToFriendRequest, validateRemoveFriend };