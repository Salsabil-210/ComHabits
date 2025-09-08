const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  name: { 
    type: String, 
    required: [true, "Habit name is required"], 
    trim: true, 
    maxlength: 100 
  },
  description: { 
    type: String, 
    default: "", 
    trim: true, 
    maxlength: 500 
  },
  type: { 
    type: String, 
    enum: ["personal", "shared"], 
    default: "personal" 
  },
  status: { 
    type: String, 
    enum: ["active", "inactive", "completed", "pending"], 
    default: "active" 
  },
  streak: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  startDate: { 
    type: Date, 
    required: false,
    index: true  
  },
  endDate: { 
    type: Date, 
    required: false,
    index: true  
  },
  repeat: { 
    type: String, 
    enum: ["daily", "weekly", "monthly",], 
    default: null
  },
 reminderOffsets: {
  type: [Number],
  default: [], // Default empty array
  validate: {
    validator: function(v) {
      // Allow empty array
      if (v.length === 0) return true;
      
      // Validate each number if array is not empty
      return v.every(num => 
        Number.isInteger(num) && 
        num >= 1 && 
        num <= 5
      );
    },
    message: props => `Each reminder offset must be an integer between 1 and 5`
  }
},
  frequency: { 
    type: String, 
    enum: ["every 1 week", "every 2 weeks", "every 3 weeks", "every 1 month", "every 2 months", "every 3 months"],
    default: null
  },
  repeatDays: { 
    type: [String], 
    default: [],
    validate: {  
      validator: function(days) {
        const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        return days.every(day => validDays.includes(day));
      },
      message: props => `${props.value} contains invalid day names`
    }
  },
  selectedMonthlyDates: {
    type: [String],
    default: [],
    validate: {
      validator: function(dates) {
        return dates.every(date => {
          const d = new Date(date);
          return !isNaN(d.getTime());
        });
      },
      message: props => `Invalid date format in selectedMonthlyDates`
    }
  },
  reminders: [{ 
    type: Date,
    index: true  
  }],
  sharedWith: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
  }],
  sharedProgress: {
    type: Map,
    of: {
      completionDates: [{ type: Date }],
      streak: { type: Number, default: 0 }
    },
    default: {}
  },
  completionDates: [{ 
    type: Date,
    index: true  
  }],
    repeatDates: [{ type: Date
     }], // Array of calculated repeat dates
repeatCount: { 
  type: Number, 
  default: null, 
  min: 1, 
  max:365,
  validate: {
    validator: function(value) {
      return value === null || Number.isInteger(value); 
    },
    message: props => `${props.value} is not a valid integer`
  }
},
  completionStatus: [{ 
    date: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ["complete", "incomplete", "skipped"], 
      required: true 
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  lastCompleted: {  
    type: Date,
    default: null
  },
  sharedHabitId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Habit" 
  },
  timezone: { type: String, default: 'Europe/Istanbul' },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },  
  toObject: { virtuals: true }
});

// Virtual for checking if habit is active
habitSchema.virtual('isActive').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    (!this.startDate || this.startDate <= now) &&
    (!this.endDate || this.endDate >= now)
  );
});

// Indexes for better query performance
habitSchema.index({ userId: 1, status: 1 });
habitSchema.index({ userId: 1, isArchived: 1 });
habitSchema.index({ 'sharedWith.userId': 1, 'sharedWith.status': 1 });
habitSchema.index({ 'completionStatus.userId': 1 });
habitSchema.index({ 'completionStatus.date': 1 });
habitSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  if (update.$set) {
    const scheduleFields = [
      'startDate',
      'endDate',
      'repeat',
      'repeatDays',
      'frequency',
      'repeatCount',
      'selectedMonthlyDates'
    ];
    
    const isScheduleChanging = scheduleFields.some(field => field in update.$set);
    
    if (isScheduleChanging) {
      // حذف التكرارات القديمة المرتبطة بالعادة
      await this.model.updateOne(
        { _id: this._conditions._id },
        { $set: { repeatDates: [], reminders: [] } }
      );
    }
  }
  
  next();
});
// Pre-save hook to update lastCompleted and maxStreak
habitSchema.pre('save', function(next) {
  if (this.isModified('completionDates') && this.completionDates.length > 0) {
    this.lastCompleted = this.completionDates[this.completionDates.length - 1];
  }
  
  if (this.isModified('streak') && this.streak > this.maxStreak) {
    this.maxStreak = this.streak;
  }
  next();
});

module.exports = mongoose.model("Habit", habitSchema);