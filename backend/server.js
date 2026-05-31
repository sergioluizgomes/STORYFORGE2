const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { safeErrorForLog } = require('./utils/safeLog');
const { buildCorsOptions } = require('./config/corsConfig');
const { buildAppConfig } = require('./config/envConfig');
const {
    getSafeContentType,
    isAllowedUploadExtension,
    resolveSafeFilePath,
    sanitizePublicFilename,
    summarizeFilenameForLog
} = require('./utils/fileSecurity');

dotenv.config({ path: path.join(__dirname, '.env') });

let appConfig;
try {
    const envResult = buildAppConfig(process.env);
    appConfig = envResult.config;
    envResult.warnings.forEach(warning => {
        console.warn('[CONFIG] warning', warning);
    });
} catch (error) {
    const configErrors = Array.isArray(error.configErrors) ? error.configErrors : [];
    const configWarnings = Array.isArray(error.configWarnings) ? error.configWarnings : [];
    configWarnings.forEach(warning => {
        console.warn('[CONFIG] warning', warning);
    });
    configErrors.forEach(configError => {
        console.error('[CONFIG] error', configError);
    });
    process.exit(1);
}

const app = express();
const PORT = appConfig.runtime.port;
const uploadDir = appConfig.uploads.absoluteDir;

// Middleware
app.use(cors(buildCorsOptions({
    NODE_ENV: appConfig.runtime.nodeEnv,
    CORS_ORIGIN: appConfig.cors.origin,
    CORS_ALLOW_CREDENTIALS: String(appConfig.cors.allowCredentials)
})));
// Don't use express.json() globally - it interferes with multipart/form-data uploads
// Apply it only to routes that need it
app.get('/uploads/:filename', (req, res) => {
    const requestedFilename = req.params.filename;
    const filename = sanitizePublicFilename(requestedFilename);
    if (!filename) {
        console.warn('[UPLOADS] blocked_file_request', {
            reason: 'invalid_filename',
            filename: summarizeFilenameForLog(requestedFilename)
        });
        return res.status(400).json({ error: 'Invalid file request' });
    }

    if (!isAllowedUploadExtension(filename)) {
        console.warn('[UPLOADS] blocked_file_request', {
            reason: 'extension_not_allowed',
            filename: summarizeFilenameForLog(filename)
        });
        return res.status(403).json({ error: 'File type not allowed' });
    }

    const filePath = resolveSafeFilePath(uploadDir, filename);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', getSafeContentType(filename));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (!getSafeContentType(filename).startsWith('image/')) {
        res.attachment(filename);
    }

    return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) {
            console.error('[UPLOADS] file_send_failed', {
                code: err.code,
                status: err.status || err.statusCode
            });
            res.status(404).json({ error: 'File not found' });
        }
    });
});

// MongoDB Connection
mongoose.connect(appConfig.database.uri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', safeErrorForLog(err)));

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
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
