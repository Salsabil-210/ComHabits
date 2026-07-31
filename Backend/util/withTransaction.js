/**
 * Mongoose transaction helper.
 * 
 * Eliminates the boilerplate of manually managing session lifecycle
 * (startSession → startTransaction → commit/abort → endSession)
 * that was previously duplicated across sharedHabitController.js handlers.
 * 
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     // ... your transactional operations using session ...
 *     return someResult;
 *   });
 */
const mongoose = require('mongoose');

/**
 * Execute a callback within a Mongoose transaction.
 * Automatically handles session creation, commit, abort, and cleanup.
 * 
 * @param {Function} callback - Async function receiving the session as its argument.
 *                               Return a value to pass through as the result.
 * @returns {Promise<*>} The return value of the callback
 * @throws {Error} Re-throws any error from the callback after aborting the transaction
 */
const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };
