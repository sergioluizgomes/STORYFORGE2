const mongoose = require('mongoose');

const ImageStyleSchema = new mongoose.Schema({
    name: { type: String, required: true },
    prompt: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ImageStyle', ImageStyleSchema);
