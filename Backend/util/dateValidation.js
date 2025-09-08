// utils/dateValidation.js
import { isBefore, isSameDay } from 'date-fns';

export const validateFutureDatesOnly = (dates, referenceDate = new Date()) => {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  return dates.filter(date => {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    return !isBefore(dateObj, today) || isSameDay(dateObj, today);
  });
};

export const isFutureOrToday = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return !isBefore(checkDate, today) || isSameDay(checkDate, today);
};