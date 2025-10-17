const Notification = require('../models/NotificationModel');

const isSocketServerReady = () => typeof global.io?.to === 'function';

const getConnectedUsersMap = () => {
  const { connectedUsers } = global;
  return connectedUsers instanceof Map ? connectedUsers : null;
};

const emitNotificationToUser = (userId, notification) => {
  if (!isSocketServerReady()) {
    return false;
  }

  const connectedUsers = getConnectedUsersMap();
  if (!connectedUsers || !connectedUsers.has(userId)) {
    return false;
  }

  global.io.to(`user_${userId}`).emit('new_notification', notification);
  return true;
};

const deliverNotification = async (recipientId, notificationData) => {
  try {
    console.log(`Attempting to deliver notification to ${recipientId}`);
    console.log('Connected users:', getConnectedUsersMap());

    // Save notification to database
    const notification = await Notification.create(notificationData);
    const populated = await Notification.findById(notification._id)
      .populate('senderId', 'name profilePicture')
      .populate('relatedHabitId', 'name')
      .populate('relatedUserId', 'name profilePicture');

    if (emitNotificationToUser(recipientId, populated)) {
      console.log(`User ${recipientId} is online, sending real-time notification`);
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

    if (pendingNotifications.length === 0) {
      return 0;
    }

    const connectedUsers = getConnectedUsersMap();
    if (!connectedUsers || !connectedUsers.has(userId) || !isSocketServerReady()) {
      return 0;
    }

    pendingNotifications.forEach((notification) => {
      global.io.to(`user_${userId}`).emit('new_notification', notification);
    });

    console.log(`Delivered ${pendingNotifications.length} pending notifications to user ${userId}`);
    return pendingNotifications.length;

  } catch (error) {
    console.error('Pending notifications delivery error:', error);
    throw error;
  }
};

module.exports = {
  deliverNotification,
  deliverPendingNotifications
};