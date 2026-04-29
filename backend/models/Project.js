const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

function normalizeOptionalString(value) {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function stableSerialize(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
    }

    return JSON.stringify(value ?? null);
}

function resolveExistingPath(filePath) {
    if (!filePath) return null;

    const candidatePaths = [
        path.resolve(process.cwd(), filePath),
        path.resolve(__dirname, '..', filePath),
        path.resolve(__dirname, '..', '..', filePath)
    ];

    for (const candidatePath of candidatePaths) {
        if (fs.existsSync(candidatePath)) {
            return candidatePath;
        }
    }

    return null;
}

function buildProjectFingerprint(project) {
    if (!project?.originalFilePath || project.originalFilePath === 'imported-json') {
        return undefined;
    }

    const resolvedPath = resolveExistingPath(project.originalFilePath);
    if (!resolvedPath) {
        return undefined;
    }

    const sourceText = fs.readFileSync(resolvedPath, 'utf8');

    // Convert Mongoose DocumentArray subdocuments to plain objects to avoid
    // circular-reference stack overflow when stableSerialize recurses into them.
    const plainChapters = (project.initialChapterStructure || []).map(ch => ({
        number: ch.number,
        type: ch.type,
        description: ch.description || null
    }));

    return createHash('sha256').update(stableSerialize({
        type: 'project-create',
        name: project.name,
        style: project.style,
        language: project.language,
        premise: project.premise || null,
        aiProvider: project.aiProvider || null,
        aiModel: project.aiModel || null,
        imageStyle: project.imageStyle ? project.imageStyle.toString() : null,
        initialChapterStructure: plainChapters,
        sourceText
    })).digest('hex');
}

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    idempotencyKey: {
        type: String,
        trim: true,
        index: { unique: true, sparse: true }
    },
    requestFingerprint: {
        type: String,
        trim: true
    },
    originalFilePath: { type: String, required: true }, // Path to the uploaded TXT
    style: { type: String, required: true }, // e.g. "Space Opera", "Cyberpunk"
    imageStyle: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageStyle' },
    language: { type: String, default: 'Português Brasileiro' },
    aiProvider: {
        type: String,
        enum: ['gemini', 'lm-studio'],
        lowercase: true,
        set: normalizeOptionalString
    },
    aiModel: {
        type: String,
        trim: true,
        set: normalizeOptionalString
    },
    // Free-form project-specific style instructions that override or augment NarrativeStyle
    customStyle: { type: String },
    coverImageUrl: { type: String },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['new', 'analyzing', 'bible_ready', 'generating_media', 'writing', 'ready'], default: 'new' },
    premise: { type: String },
    isShortStory: { type: Boolean, default: false },
    targetWordCount: { type: Number },
    initialChapterStructure: [{
        number: Number,
        type: { type: String }, // NORMAL, ACTION, REVELATION, FINAL
        description: { type: String }
    }],
    automationProgress: {
        phase: { type: String, default: 'idle' },
        completedBeatIds: { type: [Number], default: [] },
        totalBeats: { type: Number, default: 0 },
        errors: { type: [mongoose.Schema.Types.Mixed], default: [] },
        updatedAt: { type: Date }
    }
});

ProjectSchema.pre('save', function setRequestFingerprint() {
    if (!this.requestFingerprint) {
        this.requestFingerprint = buildProjectFingerprint(this);
    }
});

module.exports = mongoose.model('Project', ProjectSchema);
