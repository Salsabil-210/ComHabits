const Notification = require('../models/NotificationModel');

const deliverNotification = async (recipientId, notificationData) => {
  try {
    console.log(`Attempting to deliver notification to ${recipientId}`);
    console.log(`Connected users:`, global.connectedUsers);
    
    // Save notification to database
    const notification = await Notification.create(notificationData);
    const populated = await Notification.findById(notification._id)
      .populate('senderId', 'name profilePicture')
      .populate('relatedHabitId', 'name')
      .populate('relatedUserId', 'name profilePicture');

    // Try real-time delivery if user is online
    if (global.connectedUsers?.[recipientId]) {
      console.log(`User ${recipientId} is online, sending real-time notification`);
      global.io.to(`user_${recipientId}`).emit('new_notification', populated);
      return { status: 'delivered', notification: populated };
    }

    console.log(`User ${recipientId} is offline, notification saved for later`);
    return { status: 'stored', notification: populated };

  } catch (error) {
    console.error('Notification delivery error:', error);
    throw error;
  }
};

const deliverPendingNotifications = async (userId) => {
  try {
    const pendingNotifications = await Notification.find({
      recipientId: userId,
      status: 'unread'
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('senderId', 'name profilePicture')
    .populate('relatedHabitId', 'name')
    .populate('relatedUserId', 'name profilePicture');

    if (pendingNotifications.length === 0) return 0;

    let deliveredCount = 0;
    for (const notification of pendingNotifications) {
      if (global.connectedUsers?.[userId]) {
        global.io.to(`user_${userId}`).emit('new_notification', notification);
        deliveredCount++;
      }
    }

    console.log(`Delivered ${deliveredCount} pending notifications to user ${userId}`);
    return deliveredCount;

  } catch (error) {
    console.error('Pending notifications delivery error:', error);
    throw error;
  }
};

module.exports = {
  deliverNotification,
  deliverPendingNotifications
};