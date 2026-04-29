const mongoose = require('mongoose');

// Explicitly define subdocument schemas

const RelationshipSchema = new mongoose.Schema({
    characterName: { type: String },
    type: { type: String }, // e.g. 'ally', 'rival', 'mentor', 'romantic', 'antagonist'
    tension: { type: String } // brief description of the dynamic
}, { _id: false });

const CharacterSchema = new mongoose.Schema({
    name: { type: String },
    role: { type: String },
    archetype: { type: String },
    description: { type: String },
    motivation: { type: String },
    visualDescription: { type: String },
    imageUrl: { type: String },
    rulingPassion: { type: String },
    theWound: { type: String },
    specialTalent: { type: String },
    mythicArchetype: { type: String },
    relationships: { type: [RelationshipSchema], default: [] }
}, { _id: false });

const SettingSchema = new mongoose.Schema({
    name: { type: String },
    type: { type: String },
    description: { type: String },
    atmosphere: { type: String },
    visualDescription: { type: String },
    imageUrl: { type: String }
}, { _id: false });

const BeatSchema = new mongoose.Schema({
    id: { type: Number },
    title: { type: String },
    description: { type: String },
    type: { type: String },
    visualDescription: { type: String },
    imageUrl: { type: String }
}, { _id: false });

const ChapterSchema = new mongoose.Schema({
    chapterNumber: { type: Number, required: true },
    title: { type: String },
    type: { type: String },
    userDescription: { type: String },
    aiSummary: { type: String },
    mythicStage: { type: String },
    beats: [BeatSchema],
    analysis: { type: String }, // Editorial analysis report
    analysisDate: { type: Date } // Date of last analysis
}, { _id: false });

const BibleSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    summary: { type: String },
    premise: { type: String },
    theCrucible: { type: String },
    characters: [CharacterSchema],
    settings: [SettingSchema],
    chapters: [ChapterSchema],
    beats: [BeatSchema] // Deprecated but kept for backward compatibility if needed
});

/**
 * Pre-save hook: keep the flat `beats` array in sync with `chapters[].beats`
 * so that all downstream code can rely on either structure without branching.
 */
BibleSchema.pre('save', function normalizeBeats() {
    if (!this.chapters || this.chapters.length === 0) return;

    const flatFromChapters = this.chapters.flatMap(ch => ch.beats || []);
    if (flatFromChapters.length === 0) return;

    // Rebuild flat array from chapters (canonical source of truth)
    this.beats = flatFromChapters;
});

module.exports = mongoose.model('Bible', BibleSchema);
