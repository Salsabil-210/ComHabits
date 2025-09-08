const mongoose = require('mongoose');

const distractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['Social Media', 'Environment', 'Health', 'Mood', 'Lack of Time', 'Other'],
    required: true
  },
  description: {
    type: String,
    required: false
  },
  severity: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  timestamp: {
    type: Date,
    default: () => {
      // Force Istanbul time (UTC+3)
      const now = new Date();
      return new Date(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Istanbul' 
      }));
    }
  }
}, { 
  timestamps: { 
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    // Override Mongoose's default UTC timestamps
    currentTime: () => {
      const now = new Date();
      return new Date(now.toLocaleString('en-US', { 
        timeZone: 'Europe/Istanbul' 
      }));
    }
  } 
});

// Indexes for performance
distractionSchema.index({ userId: 1 });
distractionSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Distraction', distractionSchema);