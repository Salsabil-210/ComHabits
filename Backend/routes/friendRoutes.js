const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const friendController = require("../controllers/friendController");
const {
    validateSendFriendRequest,
    validateRespondToFriendRequest,
    validateRemoveFriend
} = require("../middleware/friendMiddleware");

// Friend management routes
router.get("/friends", authenticate, friendController.getFriendsList);
router.get("/incoming-requests", authenticate, friendController.getIncomingRequests);
router.post("/cancel-request", authenticate, friendController.cancelFriendRequest);
router.get('/find-request/:requesterId', authenticate, friendController.findFriendRequest);
router.get('/friends/sent-requests', authenticate, friendController.getSentRequests);
router.delete("/remove-friend", authenticate, friendController.removeFriend);


// Search and request routess
router.get("/search-users", authenticate, friendController.searchUsers);
router.post("/send-request", authenticate, friendController.sendFriendRequest);
router.post('/accept-request', authenticate,friendController.acceptFriendRequest);
router.post('/reject-request',authenticate,friendController.rejectFriendRequest);

module.exports = router;