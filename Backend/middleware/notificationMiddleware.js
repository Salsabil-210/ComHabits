const Notification = require('../models/NotificationModel');

exports.validateRecipient = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification || notification.recipientId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    req.notification = notification;
    next();
  } catch (error) {
    res.status(500).json({ success: false });
  }
};