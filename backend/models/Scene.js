const mongoose = require('mongoose');

const SceneSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    chapterNumber: { type: Number },
    beatId: { type: Number, required: true }, // Links to Bible Beat
    title: { type: String },
    content: { type: String }, // The generated prose
    summary: { type: String }, // AI-generated summary of the prose
    generatedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'draft', 'final'], default: 'pending' },
    versions: [{
        content: { type: String },
        summary: { type: String }, // Summary for this version
        generatedAt: { type: Date, default: Date.now },
        params: { type: Object }, // Snapshot of params used
        versionNumber: { type: Number }
    }],
    currentParams: { type: Object }, // The params used for the current content
    instructions: { type: String }, // Specific prompts used or overrides
    wordCount: { type: Number, default: 0 } // Word count of the current content
});

// Prevent duplicate scenes for the same beat within a project
SceneSchema.index({ projectId: 1, beatId: 1 }, { unique: true });

module.exports = mongoose.model('Scene', SceneSchema);
