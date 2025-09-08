const Joi = require("joi");

const sendFriendRequestValidation = Joi.object({
    recipientId: Joi.string().required().messages({
        "string.empty": "Recipient ID is required",
        "any.required": "Recipient ID is required",
    }),
});

const respondToFriendRequestValidation = Joi.object({
    friendRequestId: Joi.string().required().messages({
        "string.empty": "Friend Request ID is required",
        "any.required": "Friend Request ID is required",
    }),
    status: Joi.string().valid("accepted", "rejected").required().messages({
        "string.empty": "Status is required",
        "any.required": "Status is required",
        "any.only": "Status must be either 'accepted' or 'rejected'",
    }),
});

const removeFriendValidation = Joi.object({
    friendId: Joi.string().required().messages({
        "string.empty": "Friend ID is required",
        "any.required": "Friend ID is required",
    }),
});

module.exports = {
    sendFriendRequestValidation,
    respondToFriendRequestValidation,
    removeFriendValidation, 
};