const { format, isAfter, isBefore, isSameDay } = require('date-fns');

const DAY_NAME_TO_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Safely converts the provided value into a Date instance.
 *
 * @param {string|Date} dateInput
 * @returns {Date}
 */
function parseDateInput(dateInput) {
  if (!dateInput) {
    return null;
  }

  if (dateInput instanceof Date) {
    return new Date(dateInput.getTime());
  }

  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      const parsed = new Date(dateInput);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const [year, month, day] = dateInput.split('-').map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const parsedDate = new Date(dateInput);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date format: ${dateInput}`);
  }
  return parsedDate;
}

function normalizeStartOfDay(date) {
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function normalizeEndOfDay(date) {
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function parseFrequencyInterval(frequency, defaultValue) {
  if (!frequency) {
    return defaultValue;
  }

  const match = /\d+/.exec(frequency);
  if (!match) {
    return defaultValue;
  }

  const parsed = parseInt(match[0], 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function createScheduleAccumulator(startDate, endDate, reminderOffsets) {
  const repeatDates = new Set();
  const reminders = new Set();

  const addDate = (date) => {
    if (!date) return false;

    const normalized = normalizeStartOfDay(date);
    if (isBefore(normalized, startDate)) {
      return false;
    }

    if (endDate && isAfter(normalized, endDate)) {
      return false;
    }

    const sizeBefore = repeatDates.size;
    const formatted = format(normalized, 'yyyy-MM-dd');
    repeatDates.add(formatted);

    if (Array.isArray(reminderOffsets)) {
      reminderOffsets.forEach((offset) => {
        const reminderDate = new Date(normalized);
        reminderDate.setDate(reminderDate.getDate() - offset);

        if (
          !isBefore(reminderDate, startDate)
          && (!endDate || !isAfter(reminderDate, endDate))
        ) {
          reminders.add(format(reminderDate, 'yyyy-MM-dd'));
        }
      });
    }

    return repeatDates.size !== sizeBefore;
  };

  return { addDate, repeatDates, reminders };
}

function generateDailySchedule({ addDate }, startDate, repeatCount) {
  const limit = repeatCount && repeatCount > 0 ? repeatCount : Infinity;
  let added = 0;
  let daysAhead = 1;

  while (added < limit) {
    const candidate = new Date(startDate);
    candidate.setDate(candidate.getDate() + daysAhead);

    if (!addDate(candidate)) {
      break;
    }

    added += 1;
    daysAhead += 1;
  }
}

function generateWeeklySchedule(accumulator, options) {
  const {
    startDate,
    repeatDays,
    frequency,
    repeatCount,
  } = options;

  if (!Array.isArray(repeatDays) || repeatDays.length === 0) {
    return;
  }

  const weeksToAdd = parseFrequencyInterval(frequency, 1);
  const weeksToRepeat = repeatCount && repeatCount > 0 ? repeatCount : Infinity;

  const firstOccurrences = repeatDays.map((day) => {
    const dayIndex = DAY_NAME_TO_INDEX[day];
    const firstDate = new Date(startDate);
    const daysToAdd = (dayIndex + 7 - firstDate.getDay()) % 7;

    if (daysToAdd === 0) {
      return firstDate;
    }

    const candidate = new Date(firstDate);
    candidate.setDate(candidate.getDate() + daysToAdd);
    return candidate;
  });

  let weeksAdded = 0;
  while (weeksAdded < weeksToRepeat) {
    let addedInCurrentWeek = false;

    firstOccurrences.forEach((initialDate) => {
      const currentDate = new Date(initialDate);
      currentDate.setDate(currentDate.getDate() + (weeksAdded * weeksToAdd * 7));
      addedInCurrentWeek = accumulator.addDate(currentDate) || addedInCurrentWeek;
    });

    if (!addedInCurrentWeek) {
      break;
    }

    weeksAdded += 1;
  }
}

function extractDayOfMonth(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (/^\d{1,2}$/.test(value)) {
      return parseInt(value, 10);
    }

    const parsed = parseDateInput(value);
    return parsed.getDate();
  }

  if (value instanceof Date) {
    return value.getDate();
  }

  throw new Error(`Invalid date value: ${value}`);
}

function generateMonthlySchedule(accumulator, options) {
  const {
    startDate,
    frequency,
    repeatCount,
    selectedMonthlyDates,
  } = options;

  if (!Array.isArray(selectedMonthlyDates) || selectedMonthlyDates.length === 0) {
    throw new Error('At least one date must be selected for monthly repetition');
  }

  const monthsToAdd = parseFrequencyInterval(frequency, 1);
  const occurrencesPerDate = repeatCount && repeatCount > 0 ? repeatCount : 5;

  const processedDates = new Set();

  selectedMonthlyDates.forEach((dateValue) => {
    const day = extractDayOfMonth(dateValue);

    if (day < 1 || day > 31) {
      throw new Error(`Day must be between 1-31: ${day}`);
    }

    let occurrences = 0;
    let monthsAdded = 0;

    while (occurrences < occurrencesPerDate && monthsAdded < 1000) {
      const currentDate = new Date(startDate);
      currentDate.setMonth(currentDate.getMonth() + (monthsAdded * monthsToAdd));

      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      // February handling
      if (month === 1) {
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const febLastDay = isLeapYear ? 29 : 28;

        if (day > febLastDay) {
          const nextMonthDate = new Date(year, 2, day - febLastDay);
          const dateKey = nextMonthDate.toISOString().split('T')[0];

          if (!processedDates.has(dateKey) && accumulator.addDate(nextMonthDate)) {
            processedDates.add(dateKey);
            occurrences += 1;
          }

          monthsAdded += 1;
          continue;
        }
      }

      currentDate.setDate(1);
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

      if (day <= lastDayOfMonth) {
        currentDate.setDate(day);
        const dateKey = currentDate.toISOString().split('T')[0];

        if (!processedDates.has(dateKey) && accumulator.addDate(currentDate)) {
          processedDates.add(dateKey);
          occurrences += 1;
        }
      } else {
        const nextMonthDate = new Date(year, month + 1, day - lastDayOfMonth);
        const dateKey = nextMonthDate.toISOString().split('T')[0];

        if (!processedDates.has(dateKey) && accumulator.addDate(nextMonthDate)) {
          processedDates.add(dateKey);
          occurrences += 1;
        }
      }

      monthsAdded += 1;
    }
  });
}

function toSortedArray(values) {
  return Array.from(values).sort((a, b) => new Date(a) - new Date(b));
}

function calculateRepeatDates({
  startDate,
  repeat,
  repeatDays,
  frequency,
  repeatCount,
  endDate,
  selectedMonthlyDates,
  reminderOffsets = [],
}) {
  if (!startDate) {
    return { repeatDates: [], reminders: [] };
  }

  const parsedStartDate = normalizeStartOfDay(parseDateInput(startDate));
  const parsedEndDate = endDate ? normalizeEndOfDay(parseDateInput(endDate)) : null;

  const accumulator = createScheduleAccumulator(parsedStartDate, parsedEndDate, reminderOffsets);

  accumulator.addDate(parsedStartDate);

  if (repeat === 'daily') {
    generateDailySchedule(accumulator, parsedStartDate, repeatCount);
  } else if (repeat === 'weekly') {
    generateWeeklySchedule(accumulator, {
      startDate: parsedStartDate,
      repeatDays,
      frequency,
      repeatCount,
    });
  } else if (repeat === 'monthly') {
    generateMonthlySchedule(accumulator, {
      startDate: parsedStartDate,
      frequency,
      repeatCount,
      selectedMonthlyDates,
    });
  }

  return {
    repeatDates: toSortedArray(accumulator.repeatDates),
    reminders: toSortedArray(accumulator.reminders),
  };
}

function validateDates({
  startDate,
  endDate,
  reminders,
  repeat,
  repeatDays,
  selectedMonthlyDates,
}) {
  const now = normalizeStartOfDay(new Date());
  const parsedStart = startDate ? normalizeStartOfDay(parseDateInput(startDate)) : null;
  const parsedEnd = endDate ? normalizeStartOfDay(parseDateInput(endDate)) : null;

  if (parsedStart && isBefore(parsedStart, now) && !isSameDay(parsedStart, now)) {
    throw new Error('Start date cannot be in the past (except today)');
  }

  if (parsedEnd && parsedStart && isBefore(parsedEnd, parsedStart)) {
    throw new Error('End date must be after the start date');
  }

  if (Array.isArray(reminders) && reminders.length > 0) {
    const uniqueReminders = new Set(reminders.map(String));
    if (uniqueReminders.size !== reminders.length) {
      throw new Error('Reminders must be unique');
    }

    reminders.forEach((reminder) => {
      const parsedReminder = normalizeStartOfDay(parseDateInput(reminder));

      if (isBefore(parsedReminder, now) && !isSameDay(parsedReminder, now)) {
        throw new Error('Reminders cannot be in the past (except today)');
      }

      if (parsedStart && isBefore(parsedReminder, parsedStart)) {
        throw new Error('Reminders must be after the start date');
      }

      if (parsedEnd && isAfter(parsedReminder, parsedEnd)) {
        throw new Error('Reminders cannot be after the end date');
      }
    });
  }

  if (repeat === 'weekly') {
    if (!Array.isArray(repeatDays) || repeatDays.length === 0) {
      throw new Error('Repeat days are required for weekly habits');
    }

    const validDays = Object.keys(DAY_NAME_TO_INDEX);
    repeatDays.forEach((day) => {
      if (!validDays.includes(day)) {
        throw new Error(`Invalid repeat day: ${day}`);
      }
    });
  }

  if (repeat === 'monthly' && selectedMonthlyDates) {
    if (!Array.isArray(selectedMonthlyDates)) {
      throw new Error('Selected monthly dates must be an array');
    }

    if (selectedMonthlyDates.length === 0) {
      throw new Error('At least one date must be selected for monthly repetition');
    }

    const uniqueDates = new Set();

    selectedMonthlyDates.forEach((dateValue) => {
      const parsedDate = normalizeStartOfDay(parseDateInput(dateValue));

      if (isBefore(parsedDate, now) && !isSameDay(parsedDate, now)) {
        throw new Error('Cannot select past dates for monthly repetition (except today)');
      }

      if (parsedStart && isBefore(parsedDate, parsedStart)) {
        throw new Error('Monthly dates cannot be before the habit start date');
      }

      if (parsedEnd && isAfter(parsedDate, parsedEnd)) {
        throw new Error('Monthly dates cannot be after the habit end date');
      }

      uniqueDates.add(parsedDate.toISOString().split('T')[0]);
    });

    if (uniqueDates.size !== selectedMonthlyDates.length) {
      throw new Error('Monthly dates must be unique');
    }
  }
}

module.exports = {
  calculateRepeatDates,
  normalizeEndOfDay,
  normalizeStartOfDay,
  parseDateInput,
  validateDates,
};

