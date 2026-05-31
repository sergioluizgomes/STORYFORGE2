const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
    structureScore: { type: Number, min: 0, max: 100, default: 0 },
    characterScore: { type: Number, min: 0, max: 100, default: 0 },
    sceneScore: { type: Number, min: 0, max: 100, default: 0 },
    continuityScore: { type: Number, min: 0, max: 100, default: 0 },
    voiceScore: { type: Number, min: 0, max: 100, default: 0 },
    genrePromiseScore: { type: Number, min: 0, max: 100, default: 0 },
    proseScore: { type: Number, min: 0, max: 100, default: 0 },
    pacingScore: { type: Number, min: 0, max: 100, default: 0 },
    bookBriefAlignmentScore: { type: Number, min: 0, max: 100, default: 0 },
    revisionReadinessScore: { type: Number, min: 0, max: 100, default: 0 },
    technicalReadinessScore: { type: Number, min: 0, max: 100, default: 0 }
}, { _id: false });

const FindingSchema = new mongoose.Schema({
    code: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low', 'warning', 'info'],
        required: true
    },
    message: { type: String, required: true, trim: true },
    evidence: { type: String, trim: true },
    impact: { type: String, trim: true },
    suggestions: { type: [String], default: [] },
    term: { type: String, trim: true },
    expectedRole: { type: String, trim: true },
    searchedIn: { type: String, trim: true },
    suggestedFix: { type: String, trim: true },
    affectedScenes: { type: [String], default: undefined },
    suggestedPlacement: { type: String, trim: true },
    whereFound: { type: String, trim: true },
    risk: { type: String, trim: true },
    sceneId: { type: String, trim: true },
    beatId: { type: String, trim: true },
    chapterNumber: { type: Number },
    requiresAuthorDecision: { type: Boolean, default: false },
    question: { type: String, trim: true }
}, { _id: false });

const RecommendationSchema = new mongoose.Schema({
    code: { type: String, required: true, trim: true },
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
    message: { type: String, required: true, trim: true }
}, { _id: false });

const QualityReportSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    source: {
        type: String,
        enum: ['heuristic', 'ai', 'hybrid', 'ai_editorial', 'ai_editorial_v1'],
        default: 'heuristic'
    },
    manuscriptVersion: {
        type: String,
        default: 'current',
        trim: true
    },
    scores: {
        type: ScoreSchema,
        default: () => ({})
    },
    publishable: {
        type: Boolean,
        default: false
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    categories: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    findings: {
        type: [FindingSchema],
        default: []
    },
    recommendations: {
        type: [RecommendationSchema],
        default: []
    },
    editorialPasses: {
        type: mongoose.Schema.Types.Mixed,
        default: () => []
    },
    openQuestions: {
        type: mongoose.Schema.Types.Mixed,
        default: () => []
    },
    revisionPlan: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    },
    recommendedMethods: {
        type: mongoose.Schema.Types.Mixed,
        default: () => []
    },
    editorialJudge: {
        type: mongoose.Schema.Types.Mixed,
        default: undefined
    },
    summary: {
        type: String,
        trim: true,
        maxlength: 1200
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
}, { timestamps: true });

QualityReportSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('QualityReport', QualityReportSchema);
