const mongoose = require('mongoose');

const BatchItemSchema = new mongoose.Schema({
    index: { type: Number, required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
});

const BatchJobSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
        default: 'pending'
    },
    items: [BatchItemSchema],
    createdAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
});

module.exports = mongoose.model('BatchJob', BatchJobSchema);
