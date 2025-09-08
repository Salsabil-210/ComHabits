const BadHabit = require('../models/BadHabitModel');
const { isToday, isYesterday, startOfDay } = require('date-fns');

exports.getHabits = async (req, res) => {
  try {
    const habits = await BadHabit.find({ userId: req.user._id });
    res.status(200).json({
      success: true,
      count: habits.length,
      data: habits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

exports.addHabit = async (req, res) => {
  try {
    const { badHabit, goodHabit } = req.body;

    if (!badHabit || !goodHabit) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both bad and good habits'
      });
    }

    const habit = await BadHabit.create({
      userId: req.user._id,
      badHabit,
      goodHabit
    });

    res.status(201).json({
      success: true,
      data: habit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create habit',
      error: error.message
    });
  }
};

exports.updateHabit = async (req, res) => {
  try {
    const habit = await BadHabit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    res.status(200).json({
      success: true,
      data: habit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update habit',
      error: error.message
    });
  }
};

exports.deleteHabit = async (req, res) => {
  try {
    const habit = await BadHabit.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete habit',
      error: error.message
    });
  }
};

exports.toggleComplete = async (req, res) => {
  try {
    const habit = await BadHabit.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!habit) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const now = new Date();
    
    // Check if already completed today
    if (habit.lastCompleted && isToday(habit.lastCompleted)) {
      return res.status(400).json({
        success: false,
        message: 'Already Completed Today'
      });
    }

    // Calculate new streak
    let newStreak = 1;
    
    if (habit.lastCompleted) {
      if (isYesterday(habit.lastCompleted)) {
        // Consecutive day - increment streak
        newStreak = habit.streak + 1;
      } else {
        // Not consecutive - reset streak to 1
        newStreak = 1;
      }
    }

    // Update the habit
    const updatedHabit = await BadHabit.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id
      },
      {
        completed: true,
        lastCompleted: now,
        streak: newStreak
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedHabit,
      message: getStreakMessage(newStreak)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to track habit',
      error: error.message
    });
  }
};

function getStreakMessage(streak) {
  if (streak === 1) return "Great start! First day of your new habit!";
  if (streak === 3) return "Awesome! 3 days in a row! Keep going!";
  if (streak === 7) return "One week streak! You're doing amazing!";
  if (streak === 14) return "Two weeks! You're building a strong habit!";
  if (streak === 21) return "21 days! You've mastered this habit!";
  if (streak === 30) return "30 days! Incredible dedication!";
  if (streak > 30) return `${streak} days! You're a habit champion!`;
  return `${streak} day streak! Keep it up!`;
}