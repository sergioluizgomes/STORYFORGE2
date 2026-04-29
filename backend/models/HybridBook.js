const mongoose = require('mongoose');

const HybridBlockSchema = new mongoose.Schema({
    order: { type: Number, required: true },
    type: { type: String, enum: ['heading', 'prose', 'image'], required: true },
    beatId: { type: Number },

    // For heading/prose
    text: { type: String },

    // For image
    prompt: { type: String },
    caption: { type: String },
    imageUrl: { type: String },
    status: { type: String, enum: ['pending', 'generating', 'generated', 'approved'], default: 'pending' },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { _id: true });

HybridBlockSchema.pre('save', function () {
    this.updatedAt = new Date();
});

const HybridBookSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    title: { type: String },

    settings: {
        imagesPerBeat: { type: Number, default: 2 },
        includeCaptions: { type: Boolean, default: true }
    },

    blocks: [HybridBlockSchema],

    status: { type: String, enum: ['draft', 'in_progress', 'completed'], default: 'draft' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

HybridBookSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('HybridBook', HybridBookSchema);
