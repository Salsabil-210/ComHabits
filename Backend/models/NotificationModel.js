const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String,
    enum: [
  'friend_request',
      'friend_request_accepted',
      'friend_request_rejected',
      'friend_removed',
      'habit_request', 
      'habit_shared',   
      'habit_shared_accepted',
      'habit_shared_rejected',
      'habit_left',
      'habit_reminder',
      'streak_milestone',
      'system'
    ],
    required: true
  },
  message: { 
    type: String, 
    required: true 
  },
  relatedHabitId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Habit' 
  },
  relatedUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
    relatedFriendRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Friend' }, // Add this field

  status: { 
    type: String, 
    enum: ['unread', 'read'], 
    default: 'unread' 
  },
  isActionable: { 
    type: Boolean, 
    default: false 
  },
  delivered: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
notificationSchema.index({ recipientId: 1, delivered: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;