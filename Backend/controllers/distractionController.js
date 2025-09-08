const Distraction = require('../models/distractionModel');
const mongoose = require('mongoose');
const { startOfDay, endOfDay, subDays, subWeeks, subMonths, subYears } = require('date-fns');

// Helper function for time ranges with proper date handling
const calculateTimeRange = (timeframe) => {
  const now = new Date();
  let startDate;

  switch (timeframe) {
    case 'day':
      // Get start of today
      startDate = startOfDay(now);
      break;
    case 'week':
      // Get start of 7 days ago
      startDate = startOfDay(subDays(now, 7));
      break;
    case 'month':
      // Get start of 1 month ago
      startDate = startOfDay(subMonths(now, 1));
      break;
    case 'year':
      // Get start of 1 year ago
      startDate = startOfDay(subYears(now, 1));
      break;
    default:
      // Default to 7 days
      startDate = startOfDay(subDays(now, 7));
  }

  return { 
    startDate, 
    endDate: endOfDay(now) // End of today
  };
};

// Log a new distraction
exports.logDistraction = async (req, res) => {
  try {
    const { category, severity, description } = req.body;
    const userId = req.user._id;

    // Validation
    if (!category || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Category and severity are required'
      });
    }

    // Validate severity range
    if (severity < 1 || severity > 5) {
      return res.status(400).json({
        success: false,
        message: 'Severity must be between 1 and 5'
      });
    }

    // Validate category
    const validCategories = ['Social Media', 'Environment', 'Health', 'Mood', 'Lack of Time', 'Other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Create distraction with current timestamp
    const distraction = await Distraction.create({
      userId,
      category,
      severity,
      description: description || `Auto: ${category} distraction`,
      timestamp: new Date() // This will use the current time
    });

    res.status(201).json({
      success: true,
      data: distraction,
      message: 'Distraction logged successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging distraction',
      error: error.message
    });
  }
};

// Get all distractions with optional timeframe filter
exports.getDistractions = async (req, res) => {
  try {
    const { timeframe } = req.query;
    const userId = req.user._id;

    let query = { userId };
    
    if (timeframe) {
      const { startDate, endDate } = calculateTimeRange(timeframe);
      query.timestamp = { $gte: startDate, $lte: endDate };
    }

    const distractions = await Distraction.find(query)
      .sort({ timestamp: -1 })
      .lean(); // Use lean() for better performance

    res.status(200).json({
      success: true,
      count: distractions.length,
      data: distractions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching distractions',
      error: error.message
    });
  }
};

// Update a distraction
exports.updateDistraction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid ID format'
      });
    }

    // Remove fields that shouldn't be updated
    const allowedUpdates = ['category', 'severity', 'description'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Validate updates if provided
    if (filteredUpdates.severity && (filteredUpdates.severity < 1 || filteredUpdates.severity > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Severity must be between 1 and 5'
      });
    }

    if (filteredUpdates.category) {
      const validCategories = ['Social Media', 'Environment', 'Health', 'Mood', 'Lack of Time', 'Other'];
      if (!validCategories.includes(filteredUpdates.category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }
    }

    const updated = await Distraction.findOneAndUpdate(
      { _id: id, userId },
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Distraction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Distraction updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Update failed',
      error: error.message
    });
  }
};

// Delete a distraction
exports.deleteDistraction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const deleted = await Distraction.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Distraction not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Distraction deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Delete failed',
      error: error.message
    });
  }
};

// Get distraction counts and analytics
exports.getDistractionCounts = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { timeframe = 'week' } = req.query;
    
    // Get time range for filtering
    const { startDate, endDate } = calculateTimeRange(timeframe);

    // Get category counts
    const categoryCounts = await Distraction.aggregate([
      { 
        $match: { 
          userId,
          timestamp: { $gte: startDate, $lte: endDate }
        } 
      },
      { 
        $group: { 
          _id: "$category", 
          count: { $sum: 1 },
          avgSeverity: { $avg: "$severity" },
          maxSeverity: { $max: "$severity" },
          minSeverity: { $min: "$severity" }
        } 
      },
      { $sort: { count: -1 } }
    ]);

    // Get severity distribution
    const severityDistribution = await Distraction.aggregate([
      { 
        $match: { 
          userId,
          timestamp: { $gte: startDate, $lte: endDate }
        } 
      },
      { 
        $group: { 
          _id: "$severity", 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    // Get total count for the timeframe
    const totalCount = await Distraction.countDocuments({
      userId,
      timestamp: { $gte: startDate, $lte: endDate }
    });

    res.json({ 
      success: true, 
      data: {
        categoryCounts,
        severityDistribution,
        totalCount,
        timeframe,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
};

// Get daily distraction trends
exports.getDistractionTrends = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { timeframe = 'week' } = req.query;
    
    const { startDate, endDate } = calculateTimeRange(timeframe);

    const trends = await Distraction.aggregate([
      { 
        $match: { 
          userId,
          timestamp: { $gte: startDate, $lte: endDate }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" }
          },
          count: { $sum: 1 },
          avgSeverity: { $avg: "$severity" },
          categories: { $addToSet: "$category" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trends',
      error: error.message
    });
  }
};