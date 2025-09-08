const Habit = require("../models/HabitModel");
const User = require("../models/UserModel");
const Friend = require("../models/FriendModel");
const Notification = require("../models/NotificationModel");
const friendService = require('../services/friendService');
const { isBefore, parseISO, isValid, isToday, isAfter, isSameDay } = require("date-fns");
const { createHabitValidation, updateHabitValidation } = require("../util/habitValidators");
const notificationController = require('./notificationController');

const mongoose = require('mongoose'); 

// Create a shared habit request
exports.createSharedHabitRequest = async (req, res) => {
  console.log('[sharedHabitController] createSharedHabitRequest initiated');
  console.log('[sharedHabitController] Request body:', req.body);
  console.log('[sharedHabitController] User ID from token:', req.userId);

  try {
    // Validate JSON structure first
    try {
      JSON.parse(JSON.stringify(req.body));
    } catch (jsonError) {
      console.error('[sharedHabitController] Invalid JSON format:', jsonError);
      return res.status(400).json({ 
        success: false,
        message: "Invalid JSON format in request body",
        error: process.env.NODE_ENV === 'development' ? jsonError.message : undefined
      });
    }

    const { name, description, recipient, startDate, endDate, reminders, repeat, repeatDays, frequency } = req.body;

    // Validate required fields
    if (!name || !recipient) {
      console.error('[sharedHabitController] Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: "Name and recipient are required fields" 
      });
    }

    // Validate recipient exists
    console.log('[sharedHabitController] Checking recipient...');
    if (recipient === req.userId.toString()) {
      console.error('[sharedHabitController] Cannot share habit with yourself');
      return res.status(400).json({ 
        success: false,
        message: "Cannot share habit with yourself" 
      });
    }

    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      console.error('[sharedHabitController] Recipient not found with ID:', recipient);
      return res.status(404).json({ 
        success: false,
        message: "Recipient user not found" 
      });
    }

    // Check friendship status using friendService
    console.log('[sharedHabitController] Checking friendship status...');
    try {
      await friendService.validateCanShare(req.userId, recipient);
    } catch (error) {
      console.error('[sharedHabitController] Friendship validation error:', error.message);
      return res.status(403).json({ 
        success: false,
        message: error.message 
      });
    }

    // Check for existing pending request for the same habit
    console.log('[sharedHabitController] Checking for existing requests for the same habit...');
    const existingRequest = await Habit.findOne({
      userId: req.userId,
      type: "shared",
      status: "pending",
      "sharedWith.userId": recipient,
      "sharedWith.status": "pending",
      name: name 
    });

    if (existingRequest) {
      console.error('[sharedHabitController] Existing pending request found for the same habit');
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
    console.log('[sharedHabitController] Creating shared habit...');
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

    console.log('[sharedHabitController] Habit data to create:', habitData);
    const habit = await Habit.create(habitData);
    console.log('[sharedHabitController] Habit created:', habit);

    // Create a notification for the recipient
    console.log('[sharedHabitController] Creating notification...');
    const requestingUser = await User.findById(req.userId).select('name profilePicture');
    if (!requestingUser) {
      console.error('[sharedHabitController] Requesting user not found');
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

    console.log('[sharedHabitController] Notification data:', notificationData);
    const notification = await Notification.create(notificationData);
    console.log('[sharedHabitController] Notification created:', notification);

    // Update recipient's notifications
    console.log('[sharedHabitController] Updating recipient notifications...');
    await User.findByIdAndUpdate(recipient, { 
      $push: { 
        notifications: {
          $each: [notification._id],
          $position: 0
        } 
      } 
    });

    console.log('[sharedHabitController] Shared habit request completed successfully');
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
  console.log('[acceptSharedHabit] Initiated for habitId:', req.params.habitId, 'by userId:', req.userId);
  const session = await mongoose.startSession();
  session.startTransaction();
  console.log('[acceptSharedHabit] Mongoose session started.');

  try {
    const { habitId } = req.params;

    // 1. Find and validate original habit
    const originalHabit = await Habit.findById(habitId).session(session);
    if (!originalHabit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Habit request not found or already processed"
      });
    }

    if (originalHabit.type !== "shared" || originalHabit.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "This is not a pending shared habit request."
      });
    }

    // 2. Check sharedWith status
    const sharedWithEntry = originalHabit.sharedWith.find(
      entry => entry.userId.toString() === req.userId.toString()
    );

    if (!sharedWithEntry || sharedWithEntry.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "No pending habit request found for this user or already accepted/rejected."
      });
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
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Accepting user not found"
      });
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

    const notification = await Notification.create([notificationData], { session });

    await User.findByIdAndUpdate(
      originalHabit.userId,
      {
        $push: {
          notifications: {
            $each: [notification[0]._id],
            $position: 0
          }
        }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const updatedOriginalHabit = await Habit.findById(habitId);

    res.status(200).json({
      success: true,
      message: "Shared habit accepted successfully",
      originalHabit: updatedOriginalHabit,
      notification: {
        id: notification[0]._id,
        message: notification[0].message
      }
    });

  } catch (error) {
    console.error('[acceptSharedHabit] ERROR:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "An unexpected server error occurred during habit acceptance.",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Reject a shared habit request
exports.rejectSharedHabit = async (req, res) => {
  console.log('[sharedHabitController] rejectSharedHabit initiated');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { habitId } = req.params;

    // Find the original habit
    console.log('[sharedHabitController] Finding original habit...');
    const originalHabit = await Habit.findById(habitId).session(session);
    if (!originalHabit) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: "Habit not found" 
      });
    }

    // Check if the current user is the intended recipient
    console.log('[sharedHabitController] Checking recipient status...');
    const sharedWithUser = originalHabit.sharedWith.find(
      entry => entry.userId.toString() === req.userId.toString()
    );

    if (!sharedWithUser || sharedWithUser.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false,
        message: "No pending habit request found for this user" 
      });
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
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
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

    const notification = await Notification.create([notificationData], { session });

    await User.findByIdAndUpdate(
      originalHabit.userId,
      { $push: { notifications: notification[0]._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Shared habit rejected successfully",
      notification: {
        id: notification[0]._id,
        message: notification[0].message
      }
    });

  } catch (error) {
    console.error('[sharedHabitController] Error rejecting shared habit:', error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      success: false,
      message: "Server error during rejection",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

// Update a shared habit
exports.updateSharedHabit = async (req, res) => {
  console.log('[sharedHabitController] updateSharedHabit initiated');
  console.log('[sharedHabitController] Habit ID:', req.params.habitId);
  console.log('[sharedHabitController] Request body:', req.body);
  console.log('[sharedHabitController] User ID from token:', req.userId);

  try {
    const { habitId } = req.params;
    const updateData = req.body;

    // Validate request body
    console.log('[sharedHabitController] Validating request body...');
    const { error } = updateHabitValidation.validate(updateData, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map((d) => d.message).join(", ");
      console.error('[sharedHabitController] Validation error:', errorMessages);
      return res.status(400).json({ message: errorMessages });
    }

    // Find the habit
    console.log('[sharedHabitController] Finding habit...');
    const habit = await Habit.findById(habitId);
    if (!habit) {
      console.error('[sharedHabitController] Habit not found');
      return res.status(404).json({ message: "Habit not found" });
    }

    // Check if user owns the habit or is an accepted participant
    console.log('[sharedHabitController] Checking permissions...');
    const isOwner = habit.userId.toString() === req.userId.toString();
    const isParticipant = habit.sharedWith.some(
      entry => entry.userId.toString() === req.userId.toString() && entry.status === "accepted"
    );

    if (!isOwner && !isParticipant) {
      console.error('[sharedHabitController] User not authorized to update this habit');
      return res.status(403).json({ message: "Not authorized to update this habit" });
    }

    // Prepare update data (exclude certain fields that shouldn't be updated)
    const { userId, type, sharedWith, sharedHabitId, ...safeUpdateData } = updateData;

    // Update the habit
    console.log('[sharedHabitController] Updating habit...');
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

    console.log('[sharedHabitController] Habit updated:', updatedHabit);

    // If this is a participant's copy, also update the original if owner is updating
    if (habit.sharedHabitId && isParticipant) {
      console.log('[sharedHabitController] Updating original shared habit...');
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

    console.log('[sharedHabitController] Shared habit updated successfully');
    res.status(200).json({ 
      message: "Shared habit updated successfully", 
      habit: updatedHabit 
    });
  } catch (error) {
    console.error('[sharedHabitController] Error updating shared habit:', error);
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
    const isOwner = habit.userId.toString() === req.userId.toString();
    const isParticipant = habit.sharedWith.some(
      entry => entry.userId.toString() === req.userId.toString() && entry.status === "accepted"
    );

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
    console.error('[sharedHabitController] Error deleting shared habit:', error);
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

        console.log(`[getSharedHabits] Fetching shared habits for userId: ${userId}`);

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
        console.log(`[getSharedHabits] Found ${sharedHabits.length} raw shared habits.`);

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
                    console.log(`[getSharedHabits] Processing recipient's copy (ID: ${habitObject._id}) for userId: ${userId}. SharedHabitId: ${habitObject.sharedHabitId}`);
                    try {
                        // We need to fetch the original habit to get its owner's (sender's) info.
                        const originalSharedHabit = await Habit.findById(habitObject.sharedHabitId)
                            .populate("userId", "name profilePicture"); // Populate the original sender's info
                        
                        if (originalSharedHabit && originalSharedHabit.userId) {
                            otherUserName = originalSharedHabit.userId.name;
                            otherUserProfilePicture = originalSharedHabit.userId.profilePicture;
                            relationType = "received"; // This is a copy of a habit received by the current user
                            console.log(`[getSharedHabits] Found original sender: ${otherUserName}`);
                        } else {
                            otherUserName = "Original Sender Unknown"; // Fallback if original sender not found
                            relationType = "received";
                            console.warn(`[getSharedHabits] Original shared habit or its sender not found for sharedHabitId: ${habitObject.sharedHabitId}`);
                        }
                    } catch (err) {
                        console.error(`[getSharedHabits] Error fetching original shared habit (ID: ${habitObject.sharedHabitId}) for recipient's copy:`, err);
                        otherUserName = "Error (Sender)";
                        relationType = "received";
                    }

                } else {
                    // Scenario B: This is an ORIGINAL shared habit created by the current user (sender).
                    // The "other user(s)" are the RECIPIENT(s) in the `sharedWith` array.
                    console.log(`[getSharedHabits] Processing original habit (ID: ${habitObject._id}) sent by userId: ${userId}.`);
                    
                    // Prioritize finding an accepted recipient
                    const acceptedRecipient = habitObject.sharedWith.find(entry => 
                        entry.status === "accepted" && entry.userId && entry.userId._id.toString() !== userId.toString()
                    );
                    
                    if (acceptedRecipient) {
                        otherUserName = acceptedRecipient.userId.name;
                        otherUserProfilePicture = acceptedRecipient.userId.profilePicture;
                        relationType = "sent";
                        console.log(`[getSharedHabits] Found accepted recipient: ${otherUserName}`);
                    } else {
                        // Fallback: Find the first recipient (can be pending) who is NOT the current user
                        const anyRecipient = habitObject.sharedWith.find(entry => 
                            entry.userId && entry.userId._id.toString() !== userId.toString()
                        );
                        if (anyRecipient) {
                            otherUserName = anyRecipient.userId.name + (anyRecipient.status === "pending" ? " (Pending)" : "");
                            otherUserProfilePicture = anyRecipient.userId.profilePicture;
                            relationType = "sent";
                            console.log(`[getSharedHabits] Found pending/other recipient: ${otherUserName}`);
                        } else {
                            otherUserName = "No Recipient Yet"; // Should ideally not happen for "shared" type
                            relationType = "sent";
                            console.log(`[getSharedHabits] No specific recipient found for original habit.`);
                        }
                    }
                }
            } else {
                // Case 2: Current user is NOT the owner of this habit.
                // This means this is an ORIGINAL shared habit that was sent *to* the current user (likely a pending request, or one they accepted).
                // The "other user" is the owner of this original habit (the original sender).
                console.log(`[getSharedHabits] Processing original habit (ID: ${habitObject._id}) sent TO userId: ${userId}. Owner is: ${habitObject.userId._id}`);
                if (habitObject.userId) {
                    otherUserName = habitObject.userId.name;
                    otherUserProfilePicture = habitObject.userId.profilePicture;
                    relationType = "received"; // This is an original habit sent by someone else to current user
                    console.log(`[getSharedHabits] Original sender for this received habit: ${otherUserName}`);
                } else {
                    otherUserName = "Unknown Sender";
                    relationType = "received";
                    console.warn(`[getSharedHabits] Habit owner not found for original habit sent to userId: ${userId}`);
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
            console.log(`[getSharedHabits] Processed habit ID: ${habitObject._id}, otherUserName: ${otherUserName}, relationType: ${relationType}`);
        }

        console.log(`[getSharedHabits] Returning ${processedSharedHabits.length} processed shared habits.`);
        res.status(200).json({
            message: "Shared habits retrieved successfully",
            sharedHabits: processedSharedHabits
        });
    } catch (error) {
        console.error('[getSharedHabits] FATAL ERROR fetching shared habits:', error);
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
    const isOwner = habit.userId.toString() === userId.toString();
    const isParticipant = habit.sharedWith.some(
      sw => sw.userId.toString() === userId.toString() && sw.status === "accepted"
    );
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
};;
// Helper function to calculate current streak
function calculateCurrentStreak(completionDates) {
  if (!completionDates || completionDates.length === 0) return 0;
  
  const sortedDates = [...completionDates].sort((a, b) => b - a);
  let streak = 1;
  let currentDate = new Date(sortedDates[0]);
  currentDate.setHours(0, 0, 0, 0);
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i]);
    prevDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
      currentDate = prevDate;
    } else if (diffDays > 1) {
      break;
    }
  }
  
  return streak;
}

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