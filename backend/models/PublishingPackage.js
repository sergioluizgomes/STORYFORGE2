const mongoose = require('mongoose');

const SHORT_STRING = {
  type: String,
  trim: true,
  maxlength: 240,
};

const MEDIUM_STRING = {
  type: String,
  trim: true,
  maxlength: 1200,
};

const LONG_STRING = {
  type: String,
  trim: true,
  maxlength: 5000,
};

const ChecklistItemSchema = new mongoose.Schema({
  label: SHORT_STRING,
  status: {
    type: String,
    trim: true,
    maxlength: 80,
    default: 'pending',
  },
  note: MEDIUM_STRING,
}, { _id: false });

const APlusModuleSchema = new mongoose.Schema({
  type: SHORT_STRING,
  headline: SHORT_STRING,
  body: MEDIUM_STRING,
  imagePrompt: MEDIUM_STRING,
  altText: SHORT_STRING,
}, { _id: false });

const MonetizationStrategySchema = new mongoose.Schema({
  mode: SHORT_STRING,
  rationale: MEDIUM_STRING,
  suggestedChannels: {
    type: [SHORT_STRING],
    default: [],
  },
  nextSteps: {
    type: [SHORT_STRING],
    default: [],
  },
  risks: {
    type: [SHORT_STRING],
    default: [],
  },
}, { _id: false });

const PublishingPackageSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  source: {
    type: String,
    enum: ['heuristic', 'ai', 'hybrid'],
    default: 'heuristic',
  },
  version: {
    type: String,
    default: 'current',
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'ready_for_review', 'needs_work'],
    default: 'draft',
  },
  title: SHORT_STRING,
  subtitle: SHORT_STRING,
  penName: SHORT_STRING,
  language: SHORT_STRING,
  descriptionShort: MEDIUM_STRING,
  descriptionLong: LONG_STRING,
  keywords: {
    type: [SHORT_STRING],
    default: [],
  },
  categories: {
    type: [SHORT_STRING],
    default: [],
  },
  aiDisclosure: SHORT_STRING,
  copyrightPage: LONG_STRING,
  authorBio: MEDIUM_STRING,
  kdpChecklist: {
    type: [ChecklistItemSchema],
    default: [],
  },
  appleChecklist: {
    type: [ChecklistItemSchema],
    default: [],
  },
  draft2DigitalChecklist: {
    type: [ChecklistItemSchema],
    default: [],
  },
  launchEmail: LONG_STRING,
  adCopy: {
    type: [MEDIUM_STRING],
    default: [],
  },
  aPlusContent: {
    modules: {
      type: [APlusModuleSchema],
      default: [],
    },
  },
  monetizationStrategy: {
    type: MonetizationStrategySchema,
    default: () => ({}),
  },
  complianceWarnings: {
    type: [MEDIUM_STRING],
    default: [],
  },
  readinessSummary: MEDIUM_STRING,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
}, { timestamps: true });

PublishingPackageSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('PublishingPackage', PublishingPackageSchema);
