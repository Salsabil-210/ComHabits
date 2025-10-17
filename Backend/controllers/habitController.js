const Habit = require("../models/HabitModel");
const User = require("../models/UserModel");
const { format, isBefore, isToday, isSameDay } = require("date-fns");
const { createHabitValidation, updateHabitValidation } = require("../util/habitValidators");
const mongoose = require('mongoose');
const {
  calculateRepeatDates,
  parseDateInput,
  validateDates,
} = require('../services/habitScheduleService');
// --- Create Habit ---
exports.createHabit = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      startDate,
      endDate,
      repeat,
      repeatDays,
      frequency,
      repeatCount,
      selectedMonthlyDates,
      reminderOffsets = []
    } = req.body;

    // ✅ التحقق من البيانات الأساسية
    if (!name || !startDate) {
      return res.status(400).json({ message: "Name and startDate are required" });
    }

    if (repeat && !repeatCount) {
      return res.status(400).json({ message: "repeatCount is required when repeat is enabled" });
    }

    if (repeat === 'weekly' && (!repeatDays || repeatDays.length === 0)) {
      return res.status(400).json({ message: "repeatDays are required for weekly repeat" });
    }

    if (repeat === 'monthly' && (!selectedMonthlyDates || selectedMonthlyDates.length === 0)) {
      return res.status(400).json({ message: "selectedMonthlyDates are required for monthly repeat" });
    }

    try {
      validateDates({
        startDate,
        endDate,
        reminders: [],
        repeat,
        repeatDays,
        selectedMonthlyDates,
      });
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    // Normalize core dates for storage and scheduling
    const parsedStartDate = parseDateInput(startDate);
    const parsedEndDate = endDate ? parseDateInput(endDate) : null;

    // ✅ حساب التكرار والتذكير
    const { repeatDates, reminders } = calculateRepeatDates({
      startDate: parsedStartDate,
      repeat,
      repeatDays,
      frequency,
      repeatCount,
      endDate: parsedEndDate,
      selectedMonthlyDates,
      reminderOffsets,
    });

    // ✅ إنشاء العادة
    const newHabit = new Habit({
      userId: req.userId,
      name,
      description,
      type,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      repeat,
      repeatDays,
      frequency,
      repeatCount,
      selectedMonthlyDates,
      reminderOffsets,
      repeatDates,
      reminders,
      createdAt: new Date()
    });

    await newHabit.save();

    // ✅ ربط العادة بالمستخدم
    await User.findByIdAndUpdate(req.userId, {
      $push: { habits: newHabit._id }
    });

    return res.status(201).json({
      message: "Habit created successfully",
      habit: newHabit
    });

  } catch (error) {
    console.error("❌ Error creating habit:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// --- Update Habit ---
exports.updateHabit = async (req, res) => {
  const { habitId } = req.params;
  const updateData = req.body;

  // Ensure reminderOffsets is always an array if present
  if (updateData.reminderOffsets !== undefined && !Array.isArray(updateData.reminderOffsets)) {
    updateData.reminderOffsets = [updateData.reminderOffsets];
  }

  try {
    // Find the habit
    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // Convert date strings to Date objects for database storage
    const convertDateFields = (data) => {
      const converted = { ...data };
      ['startDate', 'endDate'].forEach((field) => {
        if (converted[field]) {
          try {
            converted[field] = parseDateInput(converted[field]);
          } catch (error) {
            throw new Error(`Invalid ${field}: ${error.message}`);
          }
        }
      });
      return converted;
    };

    // Convert dates in updateData
    const processedUpdateData = convertDateFields(updateData);

    // Validate update data
    try {
      validateDates({
        startDate: processedUpdateData.startDate || habit.startDate,
        endDate: processedUpdateData.endDate || habit.endDate,
        reminders: [],
        repeat: processedUpdateData.repeat !== undefined ? processedUpdateData.repeat : habit.repeat,
        repeatDays: processedUpdateData.repeatDays || habit.repeatDays,
        selectedMonthlyDates: processedUpdateData.selectedMonthlyDates || habit.selectedMonthlyDates,
      });
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    // IMPORTANT FIX: Clear irrelevant fields when switching repeat types
    if (processedUpdateData.repeat !== undefined && processedUpdateData.repeat !== habit.repeat) {
      if (processedUpdateData.repeat === 'weekly') {
        processedUpdateData.selectedMonthlyDates = [];
      } else if (processedUpdateData.repeat === 'monthly') {
        // Explicitly set repeatDays to empty array when switching to monthly
        processedUpdateData.repeatDays = [];
      } else if (processedUpdateData.repeat === 'daily') {
        processedUpdateData.repeatDays = [];
        processedUpdateData.selectedMonthlyDates = [];
      }
    }

    // Fields that affect schedule
    const scheduleFields = [
      'startDate',
      'endDate', 
      'repeat',
      'repeatDays',
      'frequency',
      'repeatCount',
      'selectedMonthlyDates',
      'reminderOffsets'
    ];

    // Check if schedule needs recalculation
    const shouldRecalculate = scheduleFields.some(field => {
      if (processedUpdateData[field] === undefined) return false;
      const oldValue = habit[field];
      const newValue = processedUpdateData[field];
      
      // Handle Date comparisons
      if (oldValue instanceof Date || newValue instanceof Date) {
        return oldValue?.getTime() !== newValue?.getTime();
      }
      
      // Handle array comparisons
      if (Array.isArray(oldValue)) {
        if (!Array.isArray(newValue)) return true;
        if (oldValue.length !== newValue.length) return true;
        // Compare sorted string representations
        return JSON.stringify([...oldValue].sort()) !== JSON.stringify([...newValue].sort());
      }
      
      // Default comparison
      return oldValue !== newValue;
    });

    // Recalculate repeatDates/reminders if needed
    if (shouldRecalculate) {
      try {
        const calculatedDates = calculateRepeatDates({
          startDate: processedUpdateData.startDate || habit.startDate,
          repeat: processedUpdateData.repeat !== undefined ? processedUpdateData.repeat : habit.repeat,
          repeatDays: processedUpdateData.repeat === 'monthly'
            ? []
            : (processedUpdateData.repeatDays || habit.repeatDays),
          frequency: processedUpdateData.frequency || habit.frequency,
          repeatCount: processedUpdateData.repeatCount || habit.repeatCount,
          endDate: processedUpdateData.endDate || habit.endDate,
          selectedMonthlyDates: processedUpdateData.selectedMonthlyDates || habit.selectedMonthlyDates,
          reminderOffsets: processedUpdateData.reminderOffsets || habit.reminderOffsets || [],
        });

        // Always REPLACE, not merge, and deduplicate
        processedUpdateData.repeatDates = [...new Set(calculatedDates.repeatDates)];
        processedUpdateData.reminders = [...new Set(calculatedDates.reminders)];

        // Clear completionDates if repeat type changes
        if (processedUpdateData.repeat && processedUpdateData.repeat !== habit.repeat) {
          processedUpdateData.completionDates = [];
        }
      } catch (calcError) {
        console.error("Error calculating repeat dates:", calcError);
        return res.status(400).json({ 
          message: `Error calculating schedule: ${calcError.message}` 
        });
      }
    }

    // Update all fields
    const updatedHabit = await Habit.findByIdAndUpdate(
      habitId,
      { $set: processedUpdateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Habit updated successfully",
      habit: updatedHabit
    });

  } catch (error) {
    console.error("Error updating habit:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// --- Get Habits ---
exports.getHabits = async (req, res) => {
  try {
    // Fetch habits where userId matches and type is 'personal'
    const habits = await Habit.find({ userId: req.userId, type: "personal" });
    res.status(200).json({ message: "Habits retrieved successfully", habits });
  } catch (error) {
    console.error("Error fetching habits:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Delete Habit ---
exports.deleteHabit = async (req, res) => {
  try {
  const habitId = req.params.habitId || req.params.id;
    const habit = await Habit.findById(habitId);
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    // تحذير: عادة تحتوي على تكرارات
    if (habit.repeatDates && habit.repeatDates.length > 0) {
      console.log(`Deleting repeated habit with ${habit.repeatDates.length} occurrences`);
    }

    await Habit.findByIdAndDelete(habitId);

    await User.findByIdAndUpdate(req.userId, { $pull: { habits: habitId } });

    return res.status(200).json({
      message: "Habit and all its repeated occurrences have been deleted"
    });
  } catch (error) {
    console.error("Error deleting habit:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//--- Delete Single Occurrence ---
exports.deleteSingleHabitOccurrence = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ 
        success: false,
        message: "Date is required" 
      });
    }

    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ 
        success: false,
        message: "Habit not found" 
      });
    }

    // Normalize dates for comparison
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Filter out the target date
    habit.repeatDates = habit.repeatDates.filter(d => {
      const dDate = new Date(d);
      dDate.setHours(0, 0, 0, 0);
      return dDate.getTime() !== targetDate.getTime();
    });

    // Also remove from completion dates if exists
    habit.completionDates = habit.completionDates?.filter(d => {
      const dDate = new Date(d);
      dDate.setHours(0, 0, 0, 0);
      return dDate.getTime() !== targetDate.getTime();
    }) || [];

    await habit.save();

    return res.status(200).json({ 
      success: true,
      message: "Occurrence deleted successfully",
      habit 
    });

  } catch (error) {
    console.error("Error deleting occurrence:", error);
    return res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

// --- Track Habit Completion ---02
exports.trackHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { completed, completionDate } = req.body; // Destructure completionDate from req.body
    const userId = req.userId; 

    if (!mongoose.Types.ObjectId.isValid(habitId)) {
      return res.status(400).json({ message: "Invalid habit ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const habit = await Habit.findById(habitId);
    if (!habit) return res.status(404).json({ message: "Habit not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- Added code for preventing future habit tracking ---
    const dateToTrack = completionDate ? new Date(completionDate) : today;
    dateToTrack.setHours(0, 0, 0, 0); // Normalize to start of the day

    if (dateToTrack.getTime() > today.getTime()) {
      return res.status(400).json({ message: "Cannot track a habit for a future date." });
    }
    // --- End of added code ---

    const existingIndex = habit.completionDates.findIndex(d =>
      new Date(d).setHours(0, 0, 0, 0) === dateToTrack.getTime() // Use dateToTrack here
    );

    if (completed) {
      if (existingIndex === -1) {
        habit.completionDates.push(dateToTrack); // Push dateToTrack
        habit.streak += 1;
        // Optionally update status based on whether today's habit is completed
        if (dateToTrack.getTime() === today.getTime()) {
          habit.status = "completed";
        }
      }
    } else {
      if (existingIndex !== -1) {
        habit.completionDates.splice(existingIndex, 1);
        habit.streak = Math.max(0, habit.streak - 1);
        // Optionally update status based on whether today's habit is active/incomplete
        if (dateToTrack.getTime() === today.getTime()) {
          habit.status = "active"; // Or "inactive" depending on your logic for incomplete today
        }
      }
    }

    // Recalculate streak based on new completionDates to ensure accuracy
    habit.streak = calculateCurrentStreak(habit.completionDates);

    habit.lastCompleted = habit.completionDates.length > 0
      ? habit.completionDates[habit.completionDates.length - 1]
      : null;

    const updatedHabit = await habit.save();

    const stats = await Habit.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalHabits: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          },
          active: {
            $sum: {
              $cond: [{ $eq: ["$status", "active"] }, 1, 0]
            }
          },
          inactive: {
            $sum: {
              $cond: [{ $eq: ["$status", "inactive"] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.status(200).json({
      message: "Habit tracked successfully",
      habit: updatedHabit,
      stats: stats[0] || {
        totalHabits: 0,
        completed: 0,
        active: 0,
        inactive: 0
      }
    });

  } catch (error) {
    console.error("Error tracking habit:", error);
    res.status(500).json({
      message: "Failed to track habit",
      error: error.message
    });
  }
};

// --- Get Habits By Date Range ---
exports.getHabitsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start and end dates are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Normalize dates
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Find habits that are NOT deleted and have activity in the date range
    const habits = await Habit.find({
      userId: req.userId,
      // Filter out deleted habits
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ],
      // Find habits that have completion dates OR repeat dates in range
      $or: [
        {
          completionDates: {
            $elemMatch: {
              $gte: start,
              $lte: end
            }
          }
        },
        {
          repeatDates: {
            $elemMatch: {
              $gte: format(start, 'yyyy-MM-dd'),
              $lte: format(end, 'yyyy-MM-dd')
            }
          }
        }
      ]
    }).sort({ createdAt: -1 });

    // Generate all dates in the range
    const generateDateRange = (startDate, endDate) => {
      const dates = [];
      const current = new Date(startDate);
      
      while (current <= endDate) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    };

    const allDatesInRange = generateDateRange(start, end);

    // Process each habit to determine which dates it should appear on
    const enhancedHabits = habits.map(habit => {
      const habitObj = habit.toObject();
      
      // Get completion dates in range
      const completionDatesInRange = habit.completionDates
        ?.filter(d => {
          const date = new Date(d);
          return date >= start && date <= end;
        })
        ?.map(d => format(new Date(d), 'yyyy-MM-dd')) || [];

      // Get repeat dates in range
      const repeatDatesInRange = habit.repeatDates
        ?.filter(d => {
          const date = new Date(d);
          return date >= start && date <= end;
        }) || [];

      // Determine which dates this habit should appear on
      let datesInRange = [];

      if (repeatDatesInRange.length > 0) {
        // If habit has repeat dates in range, it should appear on those dates
        datesInRange = [...repeatDatesInRange];
      } else if (completionDatesInRange.length > 0) {
        // If habit was completed in range but no repeat dates, show only completion dates
        datesInRange = [...completionDatesInRange];
      }

      // Remove duplicates and sort
      datesInRange = [...new Set(datesInRange)].sort();

      return {
        ...habitObj,
        datesInRange,
        completionDatesInRange, // Keep track of actual completions
        isRepeated: habit.repeatDates && habit.repeatDates.length > 0
      };
    });

    // Filter out habits that don't have any dates in range
    const validHabits = enhancedHabits.filter(habit => habit.datesInRange.length > 0);

    res.status(200).json(validHabits);
  } catch (error) {
    console.error("Date range error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Utility: Is Habit Active On Date ---
function isHabitActiveOnDate(habit, date) {
  const habitStart = habit.startDate ? new Date(habit.startDate) : null;
  const habitEnd = habit.endDate ? new Date(habit.endDate) : null;
  if ((habitStart && date < habitStart) || (habitEnd && date > habitEnd)) {
    return false;
  }
  switch (habit.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      if (!habit.repeatDays?.length) return false;
      const dayMap = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, 
        Thursday: 4, Friday: 5, Saturday: 6
      };
      const todayDay = date.getDay();
      const isActiveDay = habit.repeatDays.some(day => dayMap[day] === todayDay);
      if (!isActiveDay) return false;
      const frequency = parseInt(habit.frequency?.match(/\d+/)?.[0] || "1");
      const habitStartDate = habitStart || date;
      const weeksDiff = Math.floor((date - habitStartDate) / (7 * 24 * 60 * 60 * 1000));
      return weeksDiff % frequency === 0;
    case 'monthly':
      if (!habit.selectedMonthlyDates?.length) return false;
      const dateStr = date.toISOString().split('T')[0];
      return habit.selectedMonthlyDates.includes(dateStr);
    default:
      return habitStart ? isSameDay(date, habitStart) : false;
  }
}

// --- Get Habit Stats ---
exports.getHabitStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const habits = await Habit.find({ userId: req.userId });
    const totalHabits = habits.length;

    let completedHabits = 0;
    let activeHabits = 0;
    let inactiveHabits = 0;

    habits.forEach(habit => {
      if (habit.status === 'completed') {
        completedHabits++;
      } else if (habit.status === 'active') {
        activeHabits++;
      } else {
        inactiveHabits++;
      }
    });

    let dailyCompletions = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      dailyCompletions = Array(daysDiff).fill().map((_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        return {
          date: date.toISOString().split('T')[0],
          completed: 0,
          total: 0
        };
      });

      habits.forEach(habit => {
        if (habit.completionDates && Array.isArray(habit.completionDates)) {
          habit.completionDates.forEach(completionDate => {
            const completionDay = new Date(completionDate).toISOString().split('T')[0];
            const dayIndex = dailyCompletions.findIndex(d => d.date === completionDay);
            if (dayIndex !== -1) {
              dailyCompletions[dayIndex].completed++;
            }
          });
        }
      });

      dailyCompletions.forEach(day => {
        const currentDate = new Date(day.date);
        day.total = habits.filter(habit => {
          const habitStart = habit.startDate ? new Date(habit.startDate) : null;
          const habitEnd = habit.endDate ? new Date(habit.endDate) : null;
          if ((habitStart && currentDate < habitStart) || 
              (habitEnd && currentDate > habitEnd)) {
            return false;
          }
          return true;
        }).length;
      });
    }

    res.status(200).json({
      stats: {
        totalHabits,
        completed: completedHabits,
        active: activeHabits,
        inactive: inactiveHabits,
        completionRate: totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0
      },
      dailyCompletions
    });
  } catch (error) {
    console.error("Error getting habit stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Utility: Calculate Current Streak ---
function calculateCurrentStreak(completionDates) {
  if (!completionDates || completionDates.length === 0) return 0;
  const sortedDates = [...completionDates]
    .map(d => new Date(d))
    .sort((a, b) => b - a); // Sort in descending order (most recent first)

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if today's habit is completed
  let isTodayCompleted = false;
  if (sortedDates.length > 0 && isSameDay(sortedDates[0], today)) {
    streak = 1;
    isTodayCompleted = true;
  } else if (sortedDates.length > 0 && isSameDay(sortedDates[0], new Date(today.setDate(today.getDate() - 1)))) {
    // If today is not completed, but yesterday was, streak continues from yesterday
    streak = 1;
  } else {
    return 0; // No streak if today or yesterday wasn't completed
  }

  let previousDay = new Date(sortedDates[0]);
  previousDay.setHours(0, 0, 0, 0);

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDay = new Date(sortedDates[i]);
    currentDay.setHours(0, 0, 0, 0);

    const dayBeforePrevious = new Date(previousDay);
    dayBeforePrevious.setDate(previousDay.getDate() - 1);

    if (isSameDay(currentDay, dayBeforePrevious)) {
      streak++;
    } else if (currentDay < dayBeforePrevious) {
      // If there's a gap, the streak breaks
      break;
    }
    previousDay = currentDay;
  }
  return streak;
}