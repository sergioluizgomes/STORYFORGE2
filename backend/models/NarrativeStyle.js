const mongoose = require('mongoose');

const NarrativeStyleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true }, // The description shown to the user
    instruction: { type: String, required: true }, // The actual instruction passed to the AI (fallback)

    // Specialized instructions for different generation types
    bibleInstructions: { type: String },
    sceneInstructions: { type: String },
    characterInstructions: { type: String },
    locationInstructions: { type: String },
    beatInstructions: { type: String },

    // Craft principles for writing quality
    craftPrinciples: {
        pacing: { type: String },
        characterDepth: { type: String },
        showDontTell: { type: String },
        dialogueStyle: { type: String },
        sensoryFocus: [{ type: String }],
        innerLifeRatio: { type: Number, min: 0, max: 1 },
        toneGuidelines: { type: String }
    },

    // Structural rules for narrative beats
    structureRules: {
        incitingIncidentTiming: { type: String },
        jeopardyProgression: { type: String },
        crisisPoint: { type: String },
        resolutionStyle: { type: String },
        protagonistCount: { type: Number }
    },

    // Examples to guide understanding
    examples: {
        good: [{ type: String }],
        bad: [{ type: String }]
    }
});

module.exports = mongoose.model('NarrativeStyle', NarrativeStyleSchema);
