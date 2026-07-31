/**
 * Shared date utilities for the ComHabits backend.
 * 
 * Consolidates date parsing logic that was previously duplicated across
 * habitController.js (safeParseDatee, parseLocalDate, convertDateFields)
 * and sharedHabitController.js (calculateCurrentStreak).
 */
const { isSameDay } = require('date-fns');

/**
 * Safely parse a date input (string, Date, or other) into a local Date object.
 * Handles ISO strings (with 'T'), YYYY-MM-DD strings, and existing Date objects.
 * 
 * @param {string|Date|*} dateInput - The date value to parse
 * @param {Object} [options]
 * @param {boolean} [options.normalize=false] - If true, sets hours to 00:00:00.000
 * @returns {Date|null} Parsed Date object, or null if input is falsy
 * @throws {Error} If the input cannot be parsed into a valid date
 */
const safeParseDate = (dateInput, { normalize = false } = {}) => {
  if (!dateInput) return null;

  let date;

  if (dateInput instanceof Date) {
    date = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      // ISO string format (e.g., "2025-05-30T00:00:00.000Z")
      date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    } else {
      // YYYY-MM-DD format
      const [year, month, day] = dateInput.split('-').map(Number);
      if (year && month && day) {
        date = new Date(year, month - 1, day); // month is 0-based
      } else {
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    }
  } else {
    // Fallback — try direct Date construction
    date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateInput}`);
    }
  }

  if (normalize) {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

/**
 * Convert string date fields ('startDate', 'endDate') in an object to Date objects.
 * Used during habit update processing.
 * 
 * @param {Object} data - Object potentially containing startDate/endDate string fields
 * @returns {Object} New object with date fields converted to Date objects
 * @throws {Error} If a date field cannot be parsed
 */
const convertDateFields = (data) => {
  const dateFields = ['startDate', 'endDate'];
  const converted = { ...data };

  dateFields.forEach(field => {
    if (converted[field]) {
      try {
        converted[field] = safeParseDate(converted[field]);
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

/**
 * Calculate the current streak from an array of completion dates.
 * A streak counts consecutive days of completion, starting from today or yesterday.
 * 
 * This is the single shared implementation used by both habitController
 * and sharedHabitController.
 * 
 * @param {Array<Date|string>} completionDates - Array of completion date values
 * @returns {number} The current streak length
 */
const calculateCurrentStreak = (completionDates) => {
  if (!completionDates || completionDates.length === 0) return 0;

  const sortedDates = [...completionDates]
    .map(d => new Date(d))
    .sort((a, b) => b - a); // Descending (most recent first)

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if today's habit is completed
  if (sortedDates.length > 0 && isSameDay(sortedDates[0], today)) {
    streak = 1;
  } else if (sortedDates.length > 0 && isSameDay(sortedDates[0], new Date(today.getTime() - 86400000))) {
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
};

module.exports = {
  safeParseDate,
  convertDateFields,
  calculateCurrentStreak
};
