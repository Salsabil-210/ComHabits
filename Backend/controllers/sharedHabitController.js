const Habit = require("../models/HabitModel");
const User = require("../models/UserModel");
const Friend = require("../models/FriendModel");
const Notification = require("../models/NotificationModel");
const friendService = require('../services/friendService');
const { isBefore, parseISO, isValid, isToday, isAfter, isSameDay } = require("date-fns");
const { createHabitValidation, updateHabitValidation } = require("../util/habitValidators");
const notificationController = require('./notificationController');
const mongoose = require('mongoose');
const { withTransaction } = require('../util/withTransaction');
const { calculateCurrentStreak } = require('../util/dateUtils');

/**
 * Check if a user is the owner or an accepted participant of a shared habit.
 * @param {Object} habit - The habit document
 * @param {string} userId - The user ID to check
 * @returns {{ isOwner: boolean, isParticipant: boolean }} Authorization result
 */
const checkSharedHabitAuthorization = (habit, userId) => {
  const isOwner = habit.userId.toString() === userId.toString();
  const isParticipant = habit.sharedWith.some(
    entry => entry.userId.toString() === userId.toString() && entry.status === "accepted"
  );
  return { isOwner, isParticipant };
};

// Create a shared habit request
exports.createSharedHabitRequest = async (req, res) => {


  try {
    // Validate JSON structure first
    try {
      JSON.parse(JSON.stringify(req.body));
    } catch (jsonError) {

      return res.status(400).json({ 
        success: false,
        message: "Invalid JSON format in request body",
        error: process.env.NODE_ENV === 'development' ? jsonError.message : undefined
      });
    }

    const { name, description, recipient, startDate, endDate, reminders, repeat, repeatDays, frequency } = req.body;

    // Validate required fields
    if (!name || !recipient) {
      return res.status(400).json({ 
        success: false,
        message: "Name and recipient are required fields" 
      });
    }

    // Validate recipient exists
    if (recipient === req.userId.toString()) {
      return res.status(400).json({ 
        success: false,
        message: "Cannot share habit with yourself" 
      });
    }

    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return res.status(404).json({ 
        success: false,
        message: "Recipient user not found" 
      });
    }

    // Check friendship status using friendService
    try {
      await friendService.validateCanShare(req.userId, recipient);
    } catch (error) {
      return res.status(403).json({ 
        success: false,
        message: error.message 
      });
    }

    // Check for existing pending request for the same habit
    const existingRequest = await Habit.findOne({
      userId: req.userId,
      type: "shared",
      status: "pending",
      "sharedWith.userId": recipient,
      "sharedWith.status": "pending",
      name: name 
    });

    if (existingRequest) {
      return res.status(409).json({ 
        success: false,
        message: "You already have a pending shared habit request with this user for the same habit",
        existingRequest: {
          _id: existingRequest._id,
          name: existingRequest.name,
          createdAt: existingRequest.createdAt
        }
      });
    }

    // Create the habit with pending status

    const habitData = {
      userId: req.userId,
      name,
      description,
      type: "shared",
      status: "pending",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      reminders: reminders ? reminders.map((reminder) => {
        const [hours, minutes] = reminder.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return date;
      }) : [],
      repeat: repeat || null,
      repeatDays: repeatDays || [],
      frequency: frequency || null,
      sharedWith: [{ 
        userId: recipient,
        status: "pending",
        requestedAt: new Date()
      }]
    };


    const habit = await Habit.create(habitData);


    // Create a notification for the recipient
    const requestingUser = await User.findById(req.userId).select('name profilePicture');
    if (!requestingUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    const notificationData = {
      recipientId: recipient,
      senderId: req.userId,
      type: "habit_shared",  // Changed from "habit_request" to match your model
      message: `${requestingUser.name} wants to share a habit with you: ${name}`,
      relatedHabitId: habit._id,
      status: "unread",
      isActionable: true,
      metadata: {
        habitName: name,
        habitDescription: description,
        senderName: requestingUser.name,
        senderImage: requestingUser.profilePicture
      }
    };


    const notification = await Notification.create(notificationData);


    // Update recipient's notifications
    await User.findByIdAndUpdate(recipient, { 
      $push: { 
        notifications: {
          $each: [notification._id],
          $position: 0
        } 
      } 
    });

    res.status(201).json({ 
      success: true,
      message: "Shared habit request sent successfully", 
      data: {
        habit: {
          _id: habit._id,
          name: habit.name,
          description: habit.description,
          status: habit.status,
          createdAt: habit.createdAt
        },
        notification: {
          _id: notification._id,
          message: notification.message,
          createdAt: notification.createdAt
        }
      }
    });
  } catch (error) {
    console.error('[sharedHabitController] Error creating shared habit request:', error);
    res.status(500).json({ 
      success: false,
      message: "An unexpected error occurred while creating the shared habit",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Accept a shared habit request
exports.acceptSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;

    const { notification, updatedOriginalHabit } = await withTransaction(async (session) => {
      // 1. Find and validate original habit
      const originalHabit = await Habit.findById(habitId).session(session);
      if (!originalHabit) {
        const err = new Error("Habit request not found or already processed");
        err.statusCode = 404;
        throw err;
      }

      if (originalHabit.type !== "shared" || originalHabit.status !== "pending") {
        const err = new Error("This is not a pending shared habit request.");
        err.statusCode = 400;
        throw err;
      }

      // 2. Check sharedWith status
      const sharedWithEntry = originalHabit.sharedWith.find(
        entry => entry.userId.toString() === req.userId.toString()
      );

      if (!sharedWithEntry || sharedWithEntry.status !== "pending") {
        const err = new Error("No pending habit request found for this user or already accepted/rejected.");
        err.statusCode = 403;
        throw err;
      }

      // 3. Update sharedWith status to accepted
      await Habit.findByIdAndUpdate(
        habitId,
        {
          status: "active",
          $set: {
            "sharedWith.$.status": "accepted",
            "sharedWith.$.acceptedAt": new Date()
          }
        },
        { session }
      ).where("sharedWith.userId").equals(req.userId);

      // 4. Create notification for original sender
      const acceptingUser = await User.findById(req.userId).session(session);
      if (!acceptingUser) {
        const err = new Error("Accepting user not found");
        err.statusCode = 404;
        throw err;
      }

      const notificationData = {
        recipientId: originalHabit.userId,
        senderId: req.userId,
        type: "habit_shared_accepted",
        message: `${acceptingUser.name} accepted your shared habit: ${originalHabit.name}`,
        relatedHabitId: originalHabit._id,
        status: "unread",
        isActionable: false,
        metadata: {
          habitName: originalHabit.name,
          acceptorName: acceptingUser.name,
          acceptorImage: acceptingUser.profilePicture
        }
      };

      const notif = await Notification.create([notificationData], { session });

      await User.findByIdAndUpdate(
        originalHabit.userId,
        {
          $push: {
            notifications: {
              $each: [notif[0]._id],
              $position: 0
            }
          }
        },
        { session }
      );

      return { notification: notif[0], updatedOriginalHabit: await Habit.findById(habitId) };
    });

    res.status(200).json({
      success: true,
      message: "Shared habit accepted successfully",
      originalHabit: updatedOriginalHabit,
      notification: {
        id: notification._id,
        message: notification.message
      }
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: statusCode === 500 
        ? "An unexpected server error occurred during habit acceptance." 
        : error.message,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Reject a shared habit request
exports.rejectSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;

    const { notification } = await withTransaction(async (session) => {
      // Find the original habit
      const originalHabit = await Habit.findById(habitId).session(session);
      if (!originalHabit) {
        const err = new Error("Habit not found");
        err.statusCode = 404;
        throw err;
      }

      // Check if the current user is the intended recipient
      const sharedWithUser = originalHabit.sharedWith.find(
        entry => entry.userId.toString() === req.userId.toString()
      );

      if (!sharedWithUser || sharedWithUser.status !== "pending") {
        const err = new Error("No pending habit request found for this user");
        err.statusCode = 403;
        throw err;
      }

      // Update both the sharedWith status AND the main habit status
      await Habit.findByIdAndUpdate(
        habitId,
        { 
          $set: { 
            status: "rejected",
            "sharedWith.$.status": "rejected",
            "sharedWith.$.rejectedAt": new Date()
          } 
        },
        { session }
      ).where("sharedWith.userId").equals(req.userId);

      // Create a rejection notification
      const rejectingUser = await User.findById(req.userId).session(session);
      if (!rejectingUser) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const notificationData = {
        recipientId: originalHabit.userId,
        senderId: req.userId,
        type: "habit_shared_rejected",
        message: `${rejectingUser.name} rejected your shared habit: ${originalHabit.name}`,
        relatedHabitId: habitId,
        status: "unread",
        metadata: {
          habitName: originalHabit.name,
          rejectorName: rejectingUser.name
        }
      };

      const notif = await Notification.create([notificationData], { session });

      await User.findByIdAndUpdate(
        originalHabit.userId,
        { $push: { notifications: notif[0]._id } },
        { session }
      );

      return { notification: notif[0] };
    });

    res.status(200).json({
      success: true,
      message: "Shared habit rejected successfully",
      notification: {
        id: notification._id,
        message: notification.message
      }
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Server error during rejection" : error.message,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Update a shared habit
exports.updateSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const updateData = req.body;

    // Validate request body
    const { error } = updateHabitValidation.validate(updateData, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map((d) => d.message).join(", ");
      return res.status(400).json({ message: errorMessages });
    }

    // Find the habit
    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // Check if user owns the habit or is an accepted participant
    const { isOwner, isParticipant } = checkSharedHabitAuthorization(habit, req.userId);

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ message: "Not authorized to update this habit" });
    }

    // Prepare update data (exclude certain fields that shouldn't be updated)
    const { userId, type, sharedWith, sharedHabitId, ...safeUpdateData } = updateData;

    // Update the habit
    const updatedHabit = await Habit.findByIdAndUpdate(
      habitId,
      { 
        ...safeUpdateData,
        // Handle date fields
        startDate: updateData.startDate ? new Date(updateData.startDate) : habit.startDate,
        endDate: updateData.endDate ? new Date(updateData.endDate) : habit.endDate,
        // Handle reminders array
        reminders: updateData.reminders 
          ? updateData.reminders.map(reminder => new Date(reminder)) 
          : habit.reminders
      },
      { new: true }
    );



    // If this is a participant's copy, also update the original if owner is updating
    if (habit.sharedHabitId && isParticipant) {
      await Habit.findByIdAndUpdate(
        habit.sharedHabitId,
        { 
          ...safeUpdateData,
          startDate: updateData.startDate ? new Date(updateData.startDate) : habit.startDate,
          endDate: updateData.endDate ? new Date(updateData.endDate) : habit.endDate,
          reminders: updateData.reminders 
            ? updateData.reminders.map(reminder => new Date(reminder)) 
            : habit.reminders
        }
      );
    }

    res.status(200).json({ 
      message: "Shared habit updated successfully", 
      habit: updatedHabit 
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Delete a shared habit
exports.deleteSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;

    // Find the habit
    const habit = await Habit.findById(habitId);
    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // Check if user owns the habit or is an accepted participant
    const { isOwner, isParticipant } = checkSharedHabitAuthorization(habit, req.userId);

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ message: "Not authorized to delete this habit" });
    }

    if (isOwner) {
      // OWNER deletes: remove original + all participant copies, remove from all users' habits
      const participantCopies = await Habit.find({ sharedHabitId: habitId });
      const participantIds = participantCopies.map(h => h.userId);

      // Delete all participant copies
      if (participantCopies.length > 0) {
        await Habit.deleteMany({ sharedHabitId: habitId });
        // Remove from participants' habit lists
        await User.updateMany(
          { _id: { $in: participantIds } },
          { $pull: { habits: { $in: participantCopies.map(h => h._id) } } }
        );
        // Notify participants
        const owner = await User.findById(req.userId);
        for (const copy of participantCopies) {
          await notificationController.createNotification({
            recipientId: copy.userId,
            senderId: req.userId,
            type: "habit_left",
            message: `${owner.name} deleted the shared habit: ${habit.name}`,
            status: "unread",
            metadata: { habitName: habit.name }
          });
        }
      }
      // Delete the original habit
      await Habit.findByIdAndDelete(habitId);
      // Remove from owner's habits
      await User.findByIdAndUpdate(req.userId, { $pull: { habits: habitId } });

      return res.status(200).json({ message: "Shared habit deleted for all users" });
    } else if (isParticipant) {
      // PARTICIPANT deletes: remove their copy, update original, remove from both users' habits, notify owner
      const originalHabit = await Habit.findById(habit.sharedHabitId);
      if (originalHabit) {
        // Update sharedWith status to "left"
        await Habit.updateOne(
          { _id: habit.sharedHabitId, "sharedWith.userId": req.userId },
          { $set: { "sharedWith.$.status": "left" } }
        );
        // Remove participant's copy from their habits
        await User.findByIdAndUpdate(req.userId, { $pull: { habits: habitId } });

        // Notify owner
        const participant = await User.findById(req.userId);
        await notificationController.createNotification({
          recipientId: originalHabit.userId,
          senderId: req.userId,
          type: "habit_left",
          message: `${participant.name} left the shared habit: ${originalHabit.name}`,
          status: "unread",
          metadata: { habitName: originalHabit.name }
        });
      }
      // Delete the participant's habit copy
      await Habit.findByIdAndDelete(habitId);

      return res.status(200).json({ message: "Shared habit deleted for participant and updated for owner" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all shared habits (both sent and received)
exports.getSharedHabits = async (req, res) => {
    try {
        const userId = req.userId; // Assuming req.userId is populated by auth middleware

        // Find habits where:
        // 1. The current user is the owner (sender of an original shared habit).
        // 2. The current user is the owner of a habit that was created as a copy of another shared habit (recipient's copy).
        // 3. The current user is a recipient in the 'sharedWith' array of an original shared habit (e.g., pending requests).
      const sharedHabits = await Habit.find({
    $or: [
        { userId: userId, type: "shared" },
        { "sharedWith.userId": userId, type: "shared" }
    ],
    status: { $ne: "rejected" }
})
.populate("userId", "name email profilePicture")
.populate("sharedWith.userId", "name email profilePicture")
.populate("completionStatus.userId", "name email profilePicture") 
.sort({ createdAt: -1 });


        const processedSharedHabits = [];
        const uniqueHabitIds = new Set(); // To prevent duplicates if a habit matches multiple $or clauses

        for (const habit of sharedHabits) {
            // Skip if this habit (by _id) has already been processed
            if (uniqueHabitIds.has(habit._id.toString())) {
                continue;
            }

            let otherUserName = "N/A";
            let otherUserProfilePicture = null;
            let relationType = ""; // 'sent' or 'received' or 'participant'

            // Convert mongoose document to a plain JavaScript object
            const habitObject = habit.toObject();

            // Case 1: Current user is the OWNER of this habit (habit.userId matches req.userId)
            if (habitObject.userId._id.toString() === userId.toString()) {
                if (habitObject.sharedHabitId) {
                    // Scenario A: This is the current user's (recipient's) *copy* of a shared habit.
                    // The "other user" is the ORIGINAL SENDER of the habit.
                    try {
                        // We need to fetch the original habit to get its owner's (sender's) info.
                        const originalSharedHabit = await Habit.findById(habitObject.sharedHabitId)
                            .populate("userId", "name profilePicture"); // Populate the original sender's info
                        
                        if (originalSharedHabit && originalSharedHabit.userId) {
                            otherUserName = originalSharedHabit.userId.name;
                            otherUserProfilePicture = originalSharedHabit.userId.profilePicture;
                            relationType = "received";
                        } else {
                            otherUserName = "Original Sender Unknown"; // Fallback if original sender not found
                            relationType = "received";
                        }
                    } catch (err) {

                        otherUserName = "Error (Sender)";
                        relationType = "received";
                    }

                } else {
                    // Scenario B: This is an ORIGINAL shared habit created by the current user (sender).
                    // The "other user(s)" are the RECIPIENT(s) in the `sharedWith` array.

                    
                    // Prioritize finding an accepted recipient
                    const acceptedRecipient = habitObject.sharedWith.find(entry => 
                        entry.status === "accepted" && entry.userId && entry.userId._id.toString() !== userId.toString()
                    );
                    
                    if (acceptedRecipient) {
                        otherUserName = acceptedRecipient.userId.name;
                        otherUserProfilePicture = acceptedRecipient.userId.profilePicture;
                        relationType = "sent";

                    } else {
                        // Fallback: Find the first recipient (can be pending) who is NOT the current user
                        const anyRecipient = habitObject.sharedWith.find(entry => 
                            entry.userId && entry.userId._id.toString() !== userId.toString()
                        );
                        if (anyRecipient) {
                            otherUserName = anyRecipient.userId.name + (anyRecipient.status === "pending" ? " (Pending)" : "");
                            otherUserProfilePicture = anyRecipient.userId.profilePicture;
                            relationType = "sent";
    
                        } else {
                            otherUserName = "No Recipient Yet"; // Should ideally not happen for "shared" type
                            relationType = "sent";

                        }
                    }
                }
            } else {
                // Case 2: Current user is NOT the owner of this habit.
                // This means this is an ORIGINAL shared habit that was sent *to* the current user (likely a pending request, or one they accepted).
                // The "other user" is the owner of this original habit (the original sender).

                if (habitObject.userId) {
                    otherUserName = habitObject.userId.name;
                    otherUserProfilePicture = habitObject.userId.profilePicture;
                    relationType = "received"; // This is an original habit sent by someone else to current user

                } else {
                    otherUserName = "Unknown Sender";
                    relationType = "received";

                }
            }

            // Add the processed habit with 'other user' info
            processedSharedHabits.push({
                ...habitObject,
                otherUserName: otherUserName,
                otherUserProfilePicture: otherUserProfilePicture,
                relationType: relationType // 'sent' or 'received' to help frontend
            });
            uniqueHabitIds.add(habitObject._id.toString());

        }


        res.status(200).json({
            message: "Shared habits retrieved successfully",
            sharedHabits: processedSharedHabits
        });
    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message,
        });
    }
};


exports.trackSharedHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { completed } = req.body;
    const userId = req.userId;

    // Fix: Set trackingDate to the start of the current day in UTC
    const today = new Date();
    const trackingDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // 1. Find the habit
    const habit = await Habit.findById(habitId);
    if (!habit) throw new Error("Habit not found");

    // 2. Verify user is either owner or shared participant
    const { isOwner, isParticipant } = checkSharedHabitAuthorization(habit, userId);
    if (!isOwner && !isParticipant) {
      return res.status(403).json({ message: "Not authorized to track this habit" });
    }

    // 3. Update completion status
    const existingIndex = habit.completionStatus.findIndex(
      s => isSameDay(s.date, trackingDate) && s.userId.toString() === userId.toString()
    );
    if (completed) {
      if (existingIndex === -1) {
        habit.completionStatus.push({
          date: trackingDate,
          userId: userId,
          status: "complete"
        });
      } else {
        habit.completionStatus[existingIndex].status = "complete";
      }
    } else if (existingIndex !== -1) {
      habit.completionStatus.splice(existingIndex, 1);
    }

    await habit.save();

    // 4. Return updated habit with populated user data
    const updatedHabit = await Habit.findById(habitId)
      .populate('userId', 'name profilePicture')
      .populate('sharedWith.userId', 'name profilePicture');
    res.json(updatedHabit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// calculateCurrentStreak is now imported from util/dateUtils.js

// Get shared habit progress (for all participants)
exports.getSharedHabitProgress = async (req, res) => {
  try {
    const { habitId } = req.params;
    const userId = req.userId;

    // 1. Find the habit with populated user data
    const habit = await Habit.findById(habitId)
      .populate('userId', 'name profilePicture')
      .populate('sharedWith.userId', 'name profilePicture')
      .lean();

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // 2. Identify who's who using sharedWith
    const isOwner = habit.userId._id.toString() === userId.toString();
    const friendEntry = habit.sharedWith.find(sw => 
      sw.userId._id.toString() !== userId.toString()
    );

    // 3. Structure the response
    const response = {
      habit: {
        _id: habit._id,
        name: habit.name,
        description: habit.description
      },
      owner: {
        _id: habit.userId._id,
        name: habit.userId.name,
        profilePicture: habit.userId.profilePicture,
        isYou: isOwner
      },
      friend: friendEntry ? {
        _id: friendEntry.userId._id,
        name: friendEntry.userId.name,
        profilePicture: friendEntry.userId.profilePicture,
        isYou: false
      } : null,
      completionStatus: habit.completionStatus.map(status => ({
        date: status.date,
        completedByOwner: status.userId.toString() === habit.userId._id.toString(),
        completedByFriend: friendEntry && 
          status.userId.toString() === friendEntry.userId._id.toString()
      }))
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};