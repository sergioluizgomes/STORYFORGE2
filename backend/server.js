const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Don't use express.json() globally - it interferes with multipart/form-data uploads
// Apply it only to routes that need it
app.get('/uploads/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, 'uploads', filename);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).json({ error: 'File not found' });
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/story-generator')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
const projectRoutes = require('./routes/projects');
const generationRoutes = require('./routes/generation');

app.use('/api/projects', projectRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/batch', require('./routes/batch'));
app.use('/api/scenes', require('./routes/scenes'));
app.use('/api/styles', require('./routes/styles'));
app.use('/api/narrative-styles', require('./routes/narrativeStyles'));
app.use('/api/hybrid', require('./routes/hybrid'));
app.use('/api/export', require('./routes/export'));
app.use('/api/logs', require('./routes/logs'));


// Basic Health Check
app.get('/', (req, res) => {
    res.send('Story Generator API is running');
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
