const Notification = require('../models/NotificationModel');
const Friend = require('../models/FriendModel');
const User = require('../models/UserModel');
const Habit = require('../models/HabitModel');
const mongoose = require('mongoose'); 

// NOTIFICATION CREATORS
const sendRealTimeNotification = async (notification) => {
  try {
    const populated = await Notification.findById(notification._id)
      .populate('senderId', 'name profilePicture')
      .populate('relatedUserId', 'name profilePicture')
      .populate('relatedHabitId', 'name');

    if (global.connectedUsers[notification.recipientId.toString()]) {
      global.io.to(`user_${notification.recipientId}`).emit('new_notification', populated);
    }
  } catch (error) {
    console.error('Real-time notification error:', error);
  }
};

exports.createNotification = async ({ recipientId, senderId, type, message, relatedFriendRequestId }, session = null) => {
  try {
    const notificationData = {
      recipientId,
      senderId,
      type,
      message,
      relatedFriendRequestId, 
      status: 'unread',
      delivered: false
    };

    const options = session ? { session } : {};
    const notification = await Notification.create([notificationData], options);

    await sendRealTimeNotification(notification[0]);
    return notification[0];
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
};

// FRIEND NOTIFICATIONS
exports.sendFriendRequest = async (requesterId, recipientId, friendRequestId) => {
  const requester = await User.findById(requesterId);
  if (!requester) throw new Error("Requester not found");

  return this.createNotification({
    recipientId, 
    senderId: requesterId, 
    type: 'friend_request',
    message: `${requester.name} sent you a friend request`,
    relatedFriendRequestId: requesterId, 
    isActionable: true
  });
};

exports.acceptFriendRequest = async (recipientId, requesterId, requestId) => {
  try {
    const recipient = await User.findById(recipientId);
    if (!recipient) throw new Error("Recipient not found");

    return this.createNotification({
      recipientId: requesterId, 
      senderId: recipientId, 
      type: 'friend_request_accepted',
      message: `${recipient.name} accepted your friend request`,
      relatedFriendRequestId: requestId,
      metadata: {
        actionTaken: true,
        actionType: 'accepted',
        timestamp: new Date() // Changed from toISOString() to Date object
      }
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    throw error;
  }
};

exports.rejectFriendRequest = async (recipientId, requesterId) => {
  const recipient = await User.findById(recipientId);
  if (!recipient) throw new Error("Recipient not found");

  return this.createNotification({
    recipientId: requesterId,
    senderId: recipientId,
    type: 'friend_request_rejected',
    message: `${recipient.name} declined your friend request`,
    relatedUserId: recipientId 
  });
};

exports.removeFriend = async (removerId, friendId) => {
  const remover = await User.findById(removerId);
  return this.createNotification({
      recipientId: friendId,
      senderId: removerId,
      type: 'friend_removed',
      message: `${remover.name} removed you from friends`,
      relatedUserId: removerId
  });
};

// HABIT NOTIFICATIONS
exports.sendHabitShared = async (senderId, recipientId, habitId) => {
  const sender = await User.findById(senderId);
  const habit = await Habit.findById(habitId);
  return this.createNotification({
    recipientId,
    senderId,
    type: 'habit_shared',
    message: `${sender.name} shared the habit "${habit.name}" with you`,
    relatedId: habitId,
    isActionable: true
  });
};

exports.acceptHabitShared = async (accepterId, senderId, habitId) => {
  console.log('[notificationController] Creating habit acceptance notification...');
  
  try {
    const accepter = await User.findById(accepterId).select('name profilePicture');
    const habit = await Habit.findById(habitId).select('name');
    
    if (!accepter || !habit) {
      console.error('[notificationController] Missing data for notification:', {
        accepterExists: !!accepter,
        habitExists: !!habit
      });
      throw new Error('Required data not found for notification');
    }

    const notificationData = {
      recipientId: senderId,
      senderId: accepterId,
      type: 'habit_shared_accepted',
      message: `${accepter.name} accepted your shared habit "${habit.name}"`,
      relatedHabitId: habitId,
      status: 'unread',
      isActionable: false,
      metadata: {
        habitName: habit.name,
        acceptorName: accepter.name,
        acceptorImage: accepter.profilePicture,
        acceptedAt: new Date() // Changed from toISOString() to Date object
      }
    };

    console.log('[notificationController] Notification payload:', notificationData);
    const notification = await this.createNotification(notificationData);
    
    console.log('[notificationController] Successfully created acceptance notification:', notification._id);
    return notification;
    
  } catch (error) {
    console.error('[notificationController] Failed to create acceptance notification:', error);
    throw error;
  }
};

exports.rejectHabitShared = async (rejecterId, senderId, habitId) => {
  const rejecter = await User.findById(rejecterId);
  return this.createNotification({
    recipientId: senderId,
    senderId: rejecterId,
    type: 'habit_shared_rejected',
    message: `${rejecter.name} declined your shared habit`,
    relatedId: habitId
  });
};

exports.sendHabitReminder = async (userId, habitId) => {
  const habit = await Habit.findById(habitId);
  return this.createNotification({
    recipientId: userId,
    senderId: userId,
    type: 'habit_reminder',
    message: `Don't forget to complete "${habit.name}" today!`,
    relatedId: habitId
  });
};

// NOTIFICATION MANAGEMENT
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.userId,
      status: 'unread'
    });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    const query = { recipientId: req.userId };
    if (unreadOnly) query.status = 'unread';

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('senderId', 'name profilePicture')
        .populate('relatedFriendRequestId', '_id requester recipient status'), // Populate the friend request details
      Notification.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.userId },
      { status: 'read' }, 
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.userId, status: 'unread' },
      { status: 'read' } 
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: req.userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipientId: req.userId });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear notifications' });
  }
};

exports.handleNotificationAction = async (req, res) => {
  try {
    const { action } = req.body;
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientId: req.userId,
      isActionable: true
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Actionable notification not found' });
    }

    let result;
    switch (notification.type) {
      case 'friend_request':
        result = await handleFriendRequestAction(notification, action);
        break;
      case 'habit_shared':
        result = await handleHabitSharedAction(notification, action);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unsupported notification type' });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    notification.status = 'read';
    notification.isActionable = false;
    await notification.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process action' });
  }
};

const handleHabitSharedAction = async (notification, action) => {
  try {
    const { senderId, recipientId, relatedHabitId } = notification;

    if (action === 'accept') {
      const originalHabit = await Habit.findById(relatedHabitId);
      const newHabit = await Habit.create({
        ...originalHabit.toObject(),
        _id: undefined,
        userId: recipientId,
        sharedHabitId: relatedHabitId,
        sharedWith: []
      });
      await this.acceptHabitShared(recipientId, senderId, relatedHabitId);
    } else if (action === 'reject') {
      await this.rejectHabitShared(recipientId, senderId, relatedHabitId);
    } else {
      return { success: false, message: 'Invalid action' };
    }

    return { success: true };
  } catch (error) {
    console.error('Habit shared action error:', error);
    return { success: false, message: 'Failed to process habit sharing' };
  }
};