const Habit = require("../models/HabitModel");
const User = require("../models/UserModel");
const { zonedTimeToUtc } = require('date-fns-tz');
const { format,isBefore, parseISO, isValid, isToday, isAfter, isSameDay } = require("date-fns");
const { createHabitValidation, updateHabitValidation } = require("../util/habitValidators");
const mongoose = require('mongoose');


// --- Date Validation ---
// Updated validateDates function with consistent date parsing
const validateDates = (startDate, endDate, reminders, repeat, repeatDays, selectedMonthlyDates) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day

  // Helper function for safe date parsing
  const safeParseDatee = (dateInput) => {
    if (!dateInput) return null;
    
    if (dateInput instanceof Date) {
      const date = new Date(dateInput);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    
    if (typeof dateInput === 'string') {
      // Handle ISO string format
      if (dateInput.includes('T')) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error(`Invalid date format: ${dateInput}`);
        date.setHours(0, 0, 0, 0);
        return date;
      }
      
      // Handle YYYY-MM-DD format
      const [year, month, day] = dateInput.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day);
      }
    }
    
    throw new Error(`Invalid date format: ${dateInput}`);
  };

  if (startDate) {
    const parsedStartDate = safeParseDatee(startDate);
    if (isBefore(parsedStartDate, now) && !isToday(parsedStartDate)) {
      throw new Error("Start date cannot be in the past (except today)");
    }
  }

  if (endDate) {
    const parsedEndDate = safeParseDatee(endDate);
    const parsedStartDate = startDate ? safeParseDatee(startDate) : null;
    if (parsedStartDate && isBefore(parsedEndDate, parsedStartDate)) {
      throw new Error("End date must be after the start date");
    }
  }

  // Rest of validation logic...
  if (reminders && reminders.length > 0) {
    const uniqueReminders = new Set(reminders);
    if (uniqueReminders.size !== reminders.length) {
      throw new Error("Reminders must be unique");
    }
    
    for (const reminder of reminders) {
      const parsedReminder = safeParseDatee(reminder);
      if (isBefore(parsedReminder, now) && !isToday(parsedReminder)) {
        throw new Error("Reminders cannot be in the past (except today)");
      }
      
      if (startDate) {
        const parsedStartDate = safeParseDatee(startDate);
        if (isBefore(parsedReminder, parsedStartDate)) {
          throw new Error("Reminders must be after the start date");
        }
      }
      
      if (endDate) {
        const parsedEndDate = safeParseDatee(endDate);
        if (isBefore(parsedEndDate, parsedReminder)) {
          throw new Error("Reminders cannot be after the end date");
        }
      }
    }
  }

  // Weekly validation
  if (repeat === "weekly") {
    if (!repeatDays || repeatDays.length === 0) {
      throw new Error("Repeat days are required for weekly habits");
    }
    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const day of repeatDays) {
      if (!validDays.includes(day)) {
        throw new Error(`Invalid repeat day: ${day}`);
      }
    }
  }

  // Monthly validation
  if (repeat === "monthly" && selectedMonthlyDates) {
    if (!Array.isArray(selectedMonthlyDates)) {
      throw new Error("Selected monthly dates must be an array");
    }
    if (selectedMonthlyDates.length === 0) {
      throw new Error("At least one date must be selected for monthly repetition");
    }
    
    for (const dateStr of selectedMonthlyDates) {
      const date = safeParseDatee(dateStr);
      if (isBefore(date, now) && !isSameDay(date, now)) {
        throw new Error("Cannot select past dates for monthly repetition (except today)");
      }
      
      if (startDate) {
        const parsedStartDate = safeParseDatee(startDate);
        if (isBefore(date, parsedStartDate)) {
          throw new Error("Monthly dates cannot be before the habit start date");
        }
      }
      
      if (endDate) {
        const parsedEndDate = safeParseDatee(endDate);
        if (isAfter(date, parsedEndDate)) {
          throw new Error("Monthly dates cannot be after the habit end date");
        }
      }
    }
    
    const uniqueDates = new Set(selectedMonthlyDates.map(d => safeParseDatee(d).toISOString().split('T')[0]));
    if (uniqueDates.size !== selectedMonthlyDates.length) {
      throw new Error("Monthly dates must be unique");
    }
  }
};

// --- Helper to safely parse YYYY-MM-DD into a local date ---
const parseLocalDate = (dateInput) => {
  if (!dateInput) return null;
  
  // If already a Date object, create a new one to avoid mutation
  if (dateInput instanceof Date) {
    return new Date(dateInput);
  }
  
  // If it's a string, parse it properly
  if (typeof dateInput === 'string') {
    // Handle ISO string format
    if (dateInput.includes('T')) {
      return new Date(dateInput);
    }
    // Handle YYYY-MM-DD format
    const [year, month, day] = dateInput.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day); // month is 0-based
    }
  }
  
  // Fallback - try direct Date construction
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateInput}`);
  }
  return date;
};

function hasScheduleChanged(oldHabit, newData) {
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

  return scheduleFields.some(field => {
    if (newData[field] === undefined) return false;
    
    const oldValue = oldHabit[field];
    const newValue = newData[field];
    
    // مقارنة القيم مع مراعاة التواريخ
    if (oldValue instanceof Date || newValue instanceof Date) {
      return oldValue?.getTime() !== newValue?.getTime();
    }
    
    // مقارنة المصفوفات
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }
    
    // المقارنة العادية
    return oldValue !== newValue;
  });
}
// --- Final Fix: Repeat Dates as plain strings (no timezone bugs) ---
const calculateRepeatDates = (
  startDate,
  repeat,
  repeatDays,
  frequency,
  repeatCount,
  endDate,
  selectedMonthlyDates,
  reminderOffsets = []
) => {
  const repeatDates = [];
  const reminders = [];

  // Helper to parse date strings as local dates
  const parseLocalDate = (dateStr) => {
    if (dateStr instanceof Date) return new Date(dateStr);
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Parse dates as local dates (no timezone conversion)
  const parsedStartDate = parseLocalDate(startDate);
  parsedStartDate.setHours(0, 0, 0, 0);

  const parsedEndDate = endDate ? parseLocalDate(endDate) : null;
  if (parsedEndDate) parsedEndDate.setHours(23, 59, 59, 999);

  const addDateWithReminders = (date) => {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    // Skip if before start date or after end date
    if (isBefore(normalizedDate, parsedStartDate)) return false;
    if (parsedEndDate && isAfter(normalizedDate, parsedEndDate)) return false;

    const dateStr = format(normalizedDate, 'yyyy-MM-dd');
    repeatDates.push(dateStr);

    // Calculate reminders
    reminderOffsets.forEach(offset => {
      const reminderDate = new Date(normalizedDate);
      reminderDate.setDate(reminderDate.getDate() - offset);
      if (
        !isBefore(reminderDate, parsedStartDate) && 
        (!parsedEndDate || !isAfter(reminderDate, parsedEndDate))
      ) {
        reminders.push(format(reminderDate, 'yyyy-MM-dd'));
      }
    });

    return true;
  };

  // Always add the start date first
  addDateWithReminders(parsedStartDate);

  if (repeat === "daily") {
    const actualRepeatCount = repeatCount && repeatCount > 0 ? repeatCount : Infinity;
    let addedCount = 0;
    
    for (let i = 1; addedCount < actualRepeatCount; i++) {
      const currentDate = new Date(parsedStartDate);
      currentDate.setDate(currentDate.getDate() + i);
      if (!addDateWithReminders(currentDate)) break;
      addedCount++;
    }
  } 
  else if (repeat === "weekly") {
    const weeksToAdd = parseInt(frequency?.match(/\d+/)?.[0] || "1");
    const dayMap = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    // Calculate first occurrences of each selected day
    const firstOccurrences = repeatDays.map(day => {
      const dayIndex = dayMap[day];
      const firstDate = new Date(parsedStartDate);
      
      // Find days until next occurrence of this day
      let daysToAdd = (dayIndex + 7 - firstDate.getDay()) % 7;
      // If same day, use next week (unless it's the start date)
      if (daysToAdd === 0 && firstDate > parsedStartDate) {
        daysToAdd = 7;
      }
      firstDate.setDate(firstDate.getDate() + daysToAdd);
      return firstDate;
    });

    // For weekly, repeatCount means number of weeks to repeat
    const weeksToRepeat = repeatCount && repeatCount > 0 ? repeatCount : Infinity;
    let weeksAdded = 0;

    while (weeksAdded < weeksToRepeat) {
      let addedInThisWeek = false;

      // Add all selected days for this week
      for (const firstDate of firstOccurrences) {
        const currentDate = new Date(firstDate);
        currentDate.setDate(currentDate.getDate() + (weeksAdded * weeksToAdd * 7));
        
        if (addDateWithReminders(currentDate)) {
          addedInThisWeek = true;
        }
      }

      if (addedInThisWeek) {
        weeksAdded++;
      } else {
        break; // No dates were added this week
      }
    }
  } 
 else if (repeat === "monthly") {
  const monthsToAdd = parseInt(frequency?.match(/\d+/)?.[0] || "1");
  
  // Validate selected dates
  if (!selectedMonthlyDates || !Array.isArray(selectedMonthlyDates) || selectedMonthlyDates.length === 0) {
    throw new Error("At least one date must be selected for monthly repetition");
  }

  // Convert and validate days (1-31)
  const daysOfMonth = selectedMonthlyDates.map(d => {
    let day;
    if (typeof d === 'string') {
      if (d.includes('-')) { // Date format (2025-05-30)
        const date = parseLocalDate(d);
        if (isNaN(date.getTime())) throw new Error(`Invalid date format: ${d}`);
        day = date.getDate();
      } else { // Day number ("30")
        day = parseInt(d);
        if (isNaN(day)) throw new Error(`Invalid day: ${d}`);
      }
    } else if (typeof d === 'number') {
      day = d;
    } else {
      throw new Error(`Invalid date value: ${d}`);
    }
    
    if (day < 1 || day > 31) throw new Error(`Day must be between 1-31: ${day}`);
    return day;
  });

  const occurrencesPerDate = repeatCount && repeatCount > 0 ? repeatCount : 5;
  const processedDates = new Set();

  // Process each selected day
  for (const day of daysOfMonth) {
    let occurrences = 0;
    let monthsAdded = 0;

    while (occurrences < occurrencesPerDate && monthsAdded < 1000) { // 1000 month safety limit
      const currentDate = new Date(parsedStartDate);
      currentDate.setMonth(currentDate.getMonth() + monthsAdded * monthsToAdd);
      
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      // LEAP YEAR HANDLING (February)
      if (month === 1) { // February
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const febLastDay = isLeapYear ? 29 : 28;
        
        if (day > febLastDay) {
          // Carry over to March
          const nextMonthDate = new Date(year, 2, day - febLastDay); // March = month 2
          const dateKey = nextMonthDate.toISOString().split('T')[0];
          
          if (!processedDates.has(dateKey) && addDateWithReminders(nextMonthDate)) {
            processedDates.add(dateKey);
            occurrences++;
          }
          monthsAdded++;
          continue;
        }
      }

      // REGULAR MONTHS
      currentDate.setDate(1);
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      
      if (day <= lastDayOfMonth) {
        currentDate.setDate(day);
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (!processedDates.has(dateKey) && addDateWithReminders(currentDate)) {
          processedDates.add(dateKey);
          occurrences++;
        }
      } else {
        // Carry over to next month
        const nextMonthDate = new Date(year, month + 1, day - lastDayOfMonth);
        const dateKey = nextMonthDate.toISOString().split('T')[0];
        
        if (!processedDates.has(dateKey) && addDateWithReminders(nextMonthDate)) {
          processedDates.add(dateKey);
          occurrences++;
        }
      }
      
      monthsAdded++;
    }
  }
}

  // Sort dates chronologically and remove duplicates
  const uniqueDates = [...new Set(repeatDates)].sort((a, b) => new Date(a) - new Date(b));

  return {
    repeatDates: uniqueDates,
    reminders: [...new Set(reminders)].sort((a, b) => new Date(a) - new Date(b))
  };
};

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

    // ✅ حساب التكرار والتذكير
    const { repeatDates, reminders } = calculateRepeatDates(
      startDate,
      repeat,
      repeatDays,
      frequency,
      repeatCount,
      endDate,
      selectedMonthlyDates,
      reminderOffsets
    );

    // ✅ إنشاء العادة
    const newHabit = new Habit({
      userId: req.userId,
      name,
      description,
      type,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
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
      const dateFields = ['startDate', 'endDate'];
      const converted = { ...data };
      dateFields.forEach(field => {
        if (converted[field]) {
          try {
            if (typeof converted[field] === 'string') {
              if (converted[field].includes('T')) {
                converted[field] = new Date(converted[field]);
              } else {
                const [year, month, day] = converted[field].split('-').map(Number);
                converted[field] = new Date(year, month - 1, day);
              }
            }
            if (isNaN(converted[field].getTime())) {
              throw new Error(`Invalid ${field} format`);
            }
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
      validateDates(
        processedUpdateData.startDate || habit.startDate,
        processedUpdateData.endDate || habit.endDate,
        [], // Skip reminder validation here
        processedUpdateData.repeat !== undefined ? processedUpdateData.repeat : habit.repeat,
        processedUpdateData.repeatDays || habit.repeatDays,
        processedUpdateData.selectedMonthlyDates || habit.selectedMonthlyDates
      );
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
        const calculatedDates = calculateRepeatDates(
          processedUpdateData.startDate || habit.startDate,
          processedUpdateData.repeat !== undefined ? processedUpdateData.repeat : habit.repeat,
          processedUpdateData.repeat === 'monthly' ? [] : (processedUpdateData.repeatDays || habit.repeatDays), // Force empty array for monthly
          processedUpdateData.frequency || habit.frequency,
          processedUpdateData.repeatCount || habit.repeatCount,
          processedUpdateData.endDate || habit.endDate,
          processedUpdateData.selectedMonthlyDates || habit.selectedMonthlyDates,
          processedUpdateData.reminderOffsets || habit.reminderOffsets || []
        );

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