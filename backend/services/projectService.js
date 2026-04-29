const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const Project = require('../models/Project');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
}

/**
 * Creates a new Project document from inline source text.
 * Used by the batch generation pipeline.
 *
 * @param {object} data
 * @param {string} data.name
 * @param {string} [data.style]              - Narrative style name
 * @param {string} [data.language]
 * @param {*}      [data.imageStyle]         - ImageStyle ObjectId (already resolved)
 * @param {string} data.sourceText           - Full source text content
 * @param {string} [data.premise]
 * @param {Array}  [data.initialChapterStructure]
 * @param {string} [data.aiProvider]
 * @param {string} [data.aiModel]
 * @returns {{ project: object, filePath: string }}
 */
async function createProjectInternal({
    name,
    style,
    language,
    imageStyle,
    sourceText,
    premise,
    initialChapterStructure,
    aiProvider,
    aiModel
}) {
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('O campo "name" é obrigatório');
    }

    if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
        throw new Error('O campo "sourceText" é obrigatório e não pode estar vazio');
    }

    ensureUploadsDir();

    const fileName = `${Date.now()}-batch-${Math.random().toString(36).slice(2, 8)}.txt`;
    const absoluteFilePath = path.join(UPLOADS_DIR, fileName);
    const relativeFilePath = `uploads/${fileName}`;

    fs.writeFileSync(absoluteFilePath, sourceText, 'utf8');

    const parsedChapters = Array.isArray(initialChapterStructure) ? initialChapterStructure : [];

    // Pre-compute a fingerprint so the Project pre-save hook skips its own
    // buildProjectFingerprint call (which recurses into Mongoose subdocuments and
    // overflows the stack when requestFingerprint is not already set).
    const requestFingerprint = createHash('sha256').update(
        JSON.stringify({ source: 'batch', file: relativeFilePath, name, style, language, premise: premise || null })
    ).digest('hex');

    const project = new Project({
        name: name.trim(),
        style: style || undefined,
        language: language || 'Português Brasileiro',
        imageStyle: imageStyle || undefined,
        originalFilePath: relativeFilePath,
        requestFingerprint,
        status: 'new',
        premise: premise || undefined,
        isShortStory: parsedChapters.length === 1,
        initialChapterStructure: parsedChapters,
        aiProvider: aiProvider || undefined,
        aiModel: aiModel || undefined
    });

    await project.save();

    console.log(`[PROJECT_SERVICE] project_created`, {
        projectId: project._id.toString(),
        name: project.name,
        filePath: relativeFilePath,
        chapterCount: parsedChapters.length
    });

    return { project, filePath: relativeFilePath };
}

module.exports = { createProjectInternal };
