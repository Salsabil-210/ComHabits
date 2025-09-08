const Friend = require("../models/FriendModel");
const User = require("../models/UserModel");
const moment = require('moment');
const Notification = require("../models/NotificationModel");
const notificationController = require("./notificationController");
const {
    sendFriendRequestValidation,
    respondToFriendRequestValidation,
    removeFriendValidation,
} = require("../util/friendValidators");
const mongoose = require('mongoose'); 

const REQUEST_LIMITS = {
    MAX_CANCEL_CYCLES: 3,
    MAX_SEND_ATTEMPTS: 3,
    SEND_COOLDOWN_DAYS: 5,
    DAILY_SEND_LIMIT: 10,
    COOLDOWN_PERIOD_DAYS: 5
};

// Helper function to get current UTC date
const getCurrentUTCDate = () => {
    return moment.utc().toDate();
};

// Helper function to get start of day in UTC
const getStartOfDayUTC = () => {
    return moment.utc().startOf('day').toDate();
};

exports.searchUsers = async (req, res) => {
    const { query } = req.query;
    const userId = req.userId;

    if (!query) {
        return res.status(400).json({ message: "Search query is required" });
    }

    try {
        // Get accepted friends to exclude
        const acceptedFriends = await Friend.find({
            $or: [
                { requester: userId, status: "accepted" },
                { recipient: userId, status: "accepted" }
            ]
        });

        const excludedIds = acceptedFriends.map(f =>
            f.requester.toString() === userId ? f.recipient : f.requester
        );
        excludedIds.push(userId);

        // Search users
        const users = await User.find({
            $and: [
                {
                    $or: [
                        { name: { $regex: query, $options: "i" } },
                        { surname: { $regex: query, $options: "i" } },
                        { email: { $regex: query, $options: "i" } },
                    ],
                },
                { _id: { $nin: excludedIds } },
            ],
        })
            .select("name surname profilePicture email")
            .limit(10);

        // Get pending relationships
        const pendingRelationships = await Friend.find({
            $or: [
                { requester: userId, status: "pending" },
                { recipient: userId, status: "pending" }
            ]
        });

        // Enhance with relationship status
        const usersWithStatus = users.map(user => {
            const relationship = pendingRelationships.find(rel =>
                rel.requester.toString() === user._id.toString() ||
                rel.recipient.toString() === user._id.toString()
            );

            return {
                ...user.toObject(),
                relationshipStatus: relationship ?
                    (relationship.requester.toString() === userId ?
                        'request_sent' : 'request_received') :
                    null,
                requestId: relationship?._id
            };
        });

        res.status(200).json({ users: usersWithStatus });
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.sendFriendRequest = async (req, res) => {
    const { recipientId } = req.body;
    const requesterId = req.userId;

    try {
        // Validate recipient ID
        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid recipient ID" 
            });
        }

        // Check self-request
        if (requesterId.toString() === recipientId.toString()) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot send request to yourself" 
            });
        }

        // Check daily send limit using UTC
        const todayUTC = getStartOfDayUTC();
        
        const dailyCount = await Friend.countDocuments({
            requester: requesterId,
            createdAt: { $gte: todayUTC }
        });

        if (dailyCount >= REQUEST_LIMITS.DAILY_SEND_LIMIT) {
            return res.status(429).json({
                success: false,
                message: "Daily send limit reached. Try again tomorrow."
            });
        }

        // Check existing relationship
        const existingRequest = await Friend.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId }
            ]
        }).populate('requester', 'name');

        const currentUTCDate = getCurrentUTCDate();

        if (existingRequest) {
            // Check cooldown
            if (existingRequest.cooldownUntil && currentUTCDate < existingRequest.cooldownUntil) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${moment(existingRequest.cooldownUntil).fromNow()} to send another request`,
                    cooldownUntil: existingRequest.cooldownUntil
                });
            }

            // Handle existing statuses
            if (existingRequest.status === 'accepted') {
                return res.status(400).json({ 
                    success: false, 
                    message: "Already friends with this user" 
                });
            }

            if (existingRequest.status === 'pending') {
                return res.status(400).json({ 
                    success: false, 
                    message: existingRequest.requester._id.equals(requesterId) 
                        ? "Request already sent" 
                        : "This user already sent you a request"
                });
            }

            // Handle cancelled/rejected requests
            if (existingRequest.sendAttempts >= REQUEST_LIMITS.MAX_SEND_ATTEMPTS) {
                const cooldownUntil = moment.utc().add(REQUEST_LIMITS.SEND_COOLDOWN_DAYS, 'days').toDate();
                await Friend.findByIdAndUpdate(existingRequest._id, { cooldownUntil });
                
                return res.status(429).json({
                    success: false,
                    message: `Maximum send attempts reached. Try again in ${REQUEST_LIMITS.SEND_COOLDOWN_DAYS} days.`
                });
            }

            // Reactivate request
            const updatedRequest = await Friend.findByIdAndUpdate(
                existingRequest._id,
                {
                    status: 'pending',
                    $inc: { sendAttempts: 1 },
                    lastSendDate: currentUTCDate
                },
                { new: true }
            );

            // Create notification
            await new Notification({
                recipientId: recipientId,
                senderId: requesterId,
                type: 'friend_request',
                message: `${existingRequest.requester.name} sent you a friend request`,
                relatedFriendRequestId: updatedRequest._id
            }).save();

            return res.status(200).json({
                success: true,
                message: 'Friend request sent',
                request: updatedRequest,
                remainingAttempts: REQUEST_LIMITS.MAX_SEND_ATTEMPTS - updatedRequest.sendAttempts
            });
        }

        // Create new request
        const requester = await User.findById(requesterId).select('name');
        const newRequest = await new Friend({
            requester: requesterId,
            recipient: recipientId,
            status: 'pending',
            sendAttempts: 1,
            lastSendDate: currentUTCDate
        }).save();

        // Create notification
        await new Notification({
            recipientId: recipientId,
            senderId: requesterId,
            type: 'friend_request',
            message: `${requester.name} sent you a friend request`,
            relatedFriendRequestId: newRequest._id
        }).save();

        res.status(201).json({
            success: true,
            message: 'Friend request sent successfully',
            request: newRequest,
            remainingAttempts: REQUEST_LIMITS.MAX_SEND_ATTEMPTS - 1
        });

    } catch (error) {
        console.error("Error sending friend request:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to send friend request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getSentRequests = async (req, res) => {
    try {
        const requests = await Friend.find({
            requester: req.userId,
            status: { $in: ["pending", "cancelled"] } // Include both pending and cancelled requests
        })
        .populate("recipient", "name profilePicture email")
        .sort({ createdAt: -1 });

        // Filter out cancelled requests that are older than a certain period if needed
        const filteredRequests = requests.filter(request => {
            if (request.status === 'cancelled') {
                return new Date(request.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
            }
            return true;
        });

        res.status(200).json({ 
            success: true, 
            count: filteredRequests.length,
            requests: filteredRequests 
        });
    } catch (error) {
        console.error("Error getting sent requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sent requests",
            error: error.message
        });
    }
};

exports.acceptFriendRequest = async (req, res) => {
    console.log("Accept request body:", req.body);
    console.log("User ID from auth:", req.userId);
    const session = await mongoose.startSession();
    try {
        const { requestId } = req.body;
        const userId = req.userId;

        // Validate request ID
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid friend request ID format" 
            });
        }

        session.startTransaction();

        // Find the pending request
        const friendRequest = await Friend.findOne({
            _id: requestId,
            recipient: userId,
            status: 'pending'
        }).session(session).populate('requester');

        if (!friendRequest) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Friend request not found or already processed"
            });
        }

        // Update friend request status
        friendRequest.status = 'accepted';
        await friendRequest.save({ session });

        // Add to friends lists
        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { friends: friendRequest.requester._id } },
            { session, new: true }
        );

        await User.findByIdAndUpdate(
            friendRequest.requester._id,
            { $addToSet: { friends: userId } },
            { session, new: true }
        );

        // Get current user's details for notification
        const currentUser = await User.findById(userId)
            .select('name profilePicture')
            .session(session);

        // Update original notification instead of deleting it
        await Notification.updateOne(
            {
                recipientId: userId,
                senderId: friendRequest.requester._id,
                type: 'friend_request',
                'metadata.actionTaken': { $exists: false } // Only update if not already actioned
            },
            {
                $set: {
                    status: 'read',
                    'metadata.actionTaken': true,
                    'metadata.actionType': 'accepted',
                    'metadata.timestamp': new Date(),
                    'metadata.friendshipId': friendRequest._id
                }
            }
        ).session(session);

        // Create acceptance notification for the requester
        await Notification.create([{
            recipientId: friendRequest.requester._id,
            senderId: userId,
            type: 'friend_request_accepted',
            message: `${currentUser.name} accepted your friend request`,
            relatedFriendRequestId: requestId,
            metadata: {
                actionType: 'accepted',
                timestamp: new Date().toISOString()
            }
        }], { session });

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: "Friend request accepted successfully",
            friendRequest
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error accepting friend request:", error);
        res.status(500).json({
            success: false,
            message: "Failed to accept friend request",
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

exports.rejectFriendRequest = async (req, res) => {
    console.log("Reject request body:", req.body);
    console.log("User ID from auth:", req.userId);
    const session = await mongoose.startSession();
    try {
        const { requestId } = req.body;
        const userId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid friend request ID format"
            });
        }

        session.startTransaction();

        const friendRequest = await Friend.findOne({
            _id: requestId,
            recipient: userId,
            status: 'pending'
        }).session(session).populate('requester', 'name profilePicture');

        if (!friendRequest) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Friend request not found or already processed"
            });
        }

        friendRequest.status = 'rejected';
        await friendRequest.save({ session });

        // Delete the original notification
        await Notification.deleteOne({
            recipientId: userId,
            senderId: friendRequest.requester._id,
            type: 'friend_request'
        }).session(session);

        await Notification.create([{
            recipientId: friendRequest.requester._id,
            senderId: userId,
            type: 'friend_request_rejected',
            message: `${req.user.name} declined your friend request`,
            relatedFriendRequestId: requestId
        }], { session });

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: "Friend request rejected successfully",
            request: friendRequest
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error rejecting friend request:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reject friend request",
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

exports.getFriendsList = async (req, res) => {
    const userId = req.userId;

    try {
        const friends = await Friend.find({
            $or: [
                { requester: userId, status: "accepted" },
                { recipient: userId, status: "accepted" }
            ]
        })
            .populate("requester", "name surname profilePicture email")
            .populate("recipient", "name surname profilePicture email");

        const formattedFriends = friends.map(f => {
            const isRequester = f.requester._id.toString() === userId.toString();
            const friendData = isRequester ? f.recipient : f.requester;

            return {
                ...friendData.toObject(),
                friendshipId: f._id,
                friendsSince: f.updatedAt
            };
        });

        res.status(200).json({
            success: true,
            count: formattedFriends.length,
            friends: formattedFriends
        });
    } catch (error) {
        console.error("Error getting friends list:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch friends list",
            error: error.message
        });
    }
};

exports.getIncomingRequests = async (req, res) => {
    const userId = req.userId;

    try {
        const requests = await Friend.find({
            recipient: userId,
            status: "pending"
        })
            .populate("requester", "name profilePicture email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            requests
        });
    } catch (error) {
        console.error("Error getting incoming requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch incoming requests"
        });
    }
};

exports.removeFriend = async (req, res) => {
    const { friendId: friendIdString } = req.body; 
    const userId = req.userId;

    let friendObjectId;
    try {
        friendObjectId = new mongoose.Types.ObjectId(friendIdString);
    } catch (error) {
        return res.status(400).json({ message: "Invalid friend ID format" });
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const friendship = await Friend.findOne({
            status: "accepted",
            $or: [
                { requester: userId, recipient: friendObjectId },
                { requester: friendObjectId, recipient: userId }
            ]
        }).session(session);

        if (!friendship) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Friendship not found with this user"
            });
        }

        const friendshipIdToRemove = friendship._id;

        await User.findByIdAndUpdate(
            userId,
            { $pull: { friends: friendObjectId } },
            { session }
        );

        await User.findByIdAndUpdate(
            friendObjectId,
            { $pull: { friends: userId } },
            { session }
        );

        await Friend.findByIdAndDelete(friendshipIdToRemove, { session });

        await Notification.deleteMany({
            $or: [
                { senderId: userId, recipientId: friendObjectId },
                { senderId: friendObjectId, recipientId: userId }
            ],
            type: { $in: ['friend_request', 'friend_request_accepted'] }
        }).session(session);

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: "Friend removed successfully"
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error removing friend:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove friend",
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

exports.cancelFriendRequest = async (req, res) => {
    const { requestId } = req.body;
    const userId = req.userId;

    try {
        // Validate request ID
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request ID"
            });
        }

        // Find the pending request
        const request = await Friend.findOne({
            _id: requestId,
            requester: userId,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Request not found or already processed"
            });
        }

        // Check cancellation limits
        if (request.cycles >= REQUEST_LIMITS.MAX_CANCEL_CYCLES) {
            const cooldownUntil = moment.utc().add(REQUEST_LIMITS.COOLDOWN_PERIOD_DAYS, 'days').toDate();
            await Friend.findByIdAndUpdate(requestId, { cooldownUntil });
            
            return res.status(429).json({
                success: false,
                message: `Maximum cancellations reached. Try again in ${REQUEST_LIMITS.COOLDOWN_PERIOD_DAYS} days.`
            });
        }

        const currentUTCDate = getCurrentUTCDate();

        const updatedRequest = await Friend.findByIdAndUpdate(
            requestId,
            {
                status: 'cancelled',
                $inc: { cycles: 1 },
                lastCycleDate: currentUTCDate
            },
            { new: true }
        );

        // Delete notifications
        await Notification.deleteMany({
            relatedFriendRequestId: requestId
        });

        res.status(200).json({
            success: true,
            message: 'Request cancelled successfully',
            request: updatedRequest,
            remainingCancellations: REQUEST_LIMITS.MAX_CANCEL_CYCLES - updatedRequest.cycles
        });

    } catch (error) {
        console.error("Error cancelling friend request:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.findFriendRequest = async (req, res) => {
    try {
        const request = await Friend.findOne({
            requester: req.params.requesterId,
            recipient: req.userId,
            status: 'pending'
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Friend request not found"
            });
        }

        res.status(200).json({
            success: true,
            request
        });
    } catch (error) {
        console.error("Error finding friend request:", error);
        res.status(500).json({
            success: false,
            message: "Server error while finding friend request"
        });
    }
};