const mongoose = require('mongoose');

const QualityValidationRunSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['success', 'error', 'partial'],
    default: 'success',
  },
  source: {
    type: String,
    enum: ['quality_validation_v1'],
    default: 'quality_validation_v1',
  },
  markdownReport: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    trim: true,
    maxlength: 1200,
  },
  scores: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  readiness: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  reportIds: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
}, { timestamps: true });

QualityValidationRunSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('QualityValidationRun', QualityValidationRunSchema);
