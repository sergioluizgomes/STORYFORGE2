const mongoose = require('mongoose');

const SHORT_STRING = {
    type: String,
    trim: true,
    maxlength: 160
};

const CostLedgerSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        index: true
    },
    seriesId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    },
    task: {
        ...SHORT_STRING,
        default: 'unknown',
        index: true
    },
    stage: {
        ...SHORT_STRING,
        default: 'unknown'
    },
    provider: {
        ...SHORT_STRING,
        default: 'unknown',
        index: true
    },
    model: {
        ...SHORT_STRING,
        default: 'unknown',
        index: true
    },
    requestType: {
        type: String,
        enum: ['text', 'image', 'embedding', 'vision', 'unknown'],
        default: 'unknown'
    },
    status: {
        type: String,
        enum: ['success', 'error', 'skipped'],
        default: 'success',
        index: true
    },
    inputTokens: {
        type: Number,
        min: 0,
        default: null
    },
    outputTokens: {
        type: Number,
        min: 0,
        default: null
    },
    totalTokens: {
        type: Number,
        min: 0,
        default: null
    },
    estimatedCost: {
        type: Number,
        min: 0,
        default: null
    },
    currency: {
        ...SHORT_STRING,
        default: 'USD'
    },
    durationMs: {
        type: Number,
        min: 0,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    errorSummary: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, { timestamps: true });

CostLedgerSchema.index({ projectId: 1, createdAt: -1 });
CostLedgerSchema.index({ projectId: 1, task: 1, createdAt: -1 });

module.exports = mongoose.model('CostLedger', CostLedgerSchema);
