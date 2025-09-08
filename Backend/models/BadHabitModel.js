const mongoose = require('mongoose');

const badHabitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  badHabit: {
    type: String,
    required: true,
    trim: true
  },
  goodHabit: {
    type: String,
    required: true,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  streak: {
    type: Number,
    default: 0
  },
  lastCompleted: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BadHabit', badHabitSchema);