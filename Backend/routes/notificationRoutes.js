const express = require('express');
const router = express.Router();
const Notification = require('../models/NotificationModel');
const authenticate = require('../middleware/authMiddleware');
const { deliverNotification ,markAllAsRead, deleteNotification} = require('../controllers/notificationController');

// Get all notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly, undelivered } = req.query;
    const skip = (page - 1) * limit;

    const query = { 
      recipientId: req.userId,
      ...(unreadOnly === 'true' && { status: 'unread' }),
      ...(undelivered === 'true' && { delivered: false })
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('senderId', 'name profilePicture')
        .populate('relatedHabitId', 'name')
        .populate('relatedUserId', 'name profilePicture'),
      Notification.countDocuments(query)
    ]);

    res.json({
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.userId,
      status: 'unread'
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Get single notification
router.get('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientId: req.userId
    })
    .populate('senderId', 'name profilePicture')
    .populate('relatedHabitId', 'name')
    .populate('relatedUserId', 'name profilePicture');

    if (!notification) return res.status(404).json({ success: false });
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Mark as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.userId },
      { status: 'read' }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Mark as delivered
router.patch('/:id/delivered', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.userId },
      { delivered: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// Test notification delivery
router.post('/test', authenticate, async (req, res) => {
  try {
    const testNotification = await Notification.create({
      recipientId: req.userId,
      senderId: req.userId,
      type: 'system',
      message: 'Test notification',
      status: 'unread',
      delivered: false
    });

    await deliverNotification(testNotification);
    res.json({ success: true, notification: testNotification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
//mark all as read
router.patch('/mark-all-read', authenticate,markAllAsRead);
router.delete('/:id',authenticate ,deleteNotification);

module.exports = router;