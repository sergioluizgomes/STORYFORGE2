const mongoose = require('mongoose');

const AnthologySchema = new mongoose.Schema({
    title: { type: String, required: true },
    subtitle: { type: String },
    projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    coverImageUrl: { type: String },
    coverPrompt: { type: String },
    imageStyle: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageStyle' },
    pdfPath: { type: String },
    status: { type: String, default: 'ready' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Anthology', AnthologySchema);
