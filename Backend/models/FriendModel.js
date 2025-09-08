const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected", "cancelled"],
        default: "pending"
    },
    sendAttempts: {
        type: Number,
        default: 0
    },
    // Cancel cycles
    cycles: {
        type: Number,
        default: 0
    },
    // Track when the last send attempt was made
    lastSendDate: {
        type: Date,
        default: null
    },
    // Track when the last cycle was completed
    lastCycleDate: {
        type: Date,
        default: null
    },
    cooldownUntil: {
        type: Date,
        default: null
    }
}, { 
    timestamps: true,
    // Ensure dates are stored in UTC
    toJSON: { 
        transform: function(doc, ret) {
            // Convert dates to UTC when serializing
            if (ret.createdAt) ret.createdAt = new Date(ret.createdAt).toISOString();
            if (ret.updatedAt) ret.updatedAt = new Date(ret.updatedAt).toISOString();
            if (ret.lastSendDate) ret.lastSendDate = new Date(ret.lastSendDate).toISOString();
            if (ret.lastCycleDate) ret.lastCycleDate = new Date(ret.lastCycleDate).toISOString();
            if (ret.cooldownUntil) ret.cooldownUntil = new Date(ret.cooldownUntil).toISOString();
            return ret;
        }
    }
});

// Compound index to prevent duplicate requests
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Index for efficient querying by status and dates
friendSchema.index({ status: 1, createdAt: -1 });
friendSchema.index({ requester: 1, status: 1 });
friendSchema.index({ recipient: 1, status: 1 });

// Pre-save middleware to ensure dates are stored in UTC
friendSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('lastSendDate')) {
        if (this.lastSendDate && !(this.lastSendDate instanceof Date)) {
            this.lastSendDate = new Date(this.lastSendDate);
        }
    }
    
    if (this.isNew || this.isModified('lastCycleDate')) {
        if (this.lastCycleDate && !(this.lastCycleDate instanceof Date)) {
            this.lastCycleDate = new Date(this.lastCycleDate);
        }
    }
    
    if (this.isNew || this.isModified('cooldownUntil')) {
        if (this.cooldownUntil && !(this.cooldownUntil instanceof Date)) {
            this.cooldownUntil = new Date(this.cooldownUntil);
        }
    }
    
    next();
});

module.exports = mongoose.model("Friend", friendSchema);