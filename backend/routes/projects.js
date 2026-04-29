const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Project = require('../models/Project');
const Anthology = require('../models/Anthology');
const Bible = require('../models/Bible');
const Scene = require('../models/Scene');
const ImageStyle = require('../models/ImageStyle');
const mongoose = require('mongoose');
const fs = require('fs');
const { createHash } = require('crypto');

function normalizeTextAiValues(payload = {}) {
    const updates = { ...payload };
    const unset = {};

    for (const field of ['aiProvider', 'aiModel']) {
        if (!(field in updates)) continue;

        const value = updates[field];
        if (typeof value !== 'string') {
            if (value == null) {
                delete updates[field];
                unset[field] = 1;
            }
            continue;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            delete updates[field];
            unset[field] = 1;
            continue;
        }

        updates[field] = field === 'aiProvider' ? trimmed.toLowerCase() : trimmed;
    }

    return { updates, unset };
}

// Configure Multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });
const uploadMemory = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const jsonParser = express.json({ limit: '10mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' });
const activeProjectRequests = new Map();

function parseProjectCreateRequest(req, res, next) {
    if (req.is('multipart/form-data')) {
        return upload.single('file')(req, res, next);
    }

    if (req.is('application/json')) {
        return jsonParser(req, res, next);
    }

    if (req.is('application/x-www-form-urlencoded')) {
        return urlencodedParser(req, res, next);
    }

    return next();
}

function normalizeOptionalObjectId(value) {
    if (typeof value !== 'string') return value ?? undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function getIdempotencyKey(req) {
    const headerValue = req.get('x-idempotency-key') || req.headers['x-idempotency-key'];
    const bodyValue = req.body?.idempotencyKey;
    const value = typeof headerValue === 'string' && headerValue.trim().length > 0
        ? headerValue
        : bodyValue;

    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

async function findProjectByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    return Project.findOne({ idempotencyKey });
}

function isDuplicateIdempotencyError(error) {
    return error?.code === 11000 && Boolean(error?.keyPattern?.idempotencyKey || error?.keyValue?.idempotencyKey);
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

function hashValue(value) {
    return createHash('sha256').update(value).digest('hex');
}

function buildCreateFingerprint({
    name,
    style,
    language,
    premise,
    aiProvider,
    aiModel,
    initialChapterStructure,
    sourceKind,
    sourceHash,
    imageStyle
}) {
    return hashValue(stableSerialize({
        type: 'project-create',
        name,
        style,
        language,
        premise,
        aiProvider,
        aiModel,
        initialChapterStructure,
        sourceKind,
        sourceHash,
        imageStyle: imageStyle || null
    }));
}

function buildImportFingerprint(importData) {
    return hashValue(stableSerialize({
        type: 'project-import',
        project: importData?.project || null,
        bible: importData?.bible || null,
        scenes: importData?.scenes || []
    }));
}

async function findRecentProjectByFingerprint(requestFingerprint) {
    if (!requestFingerprint) return null;

    return Project.findOne({
        requestFingerprint,
        createdAt: { $gte: new Date(Date.now() - (10 * 60 * 1000)) }
    }).sort({ createdAt: -1 });
}

function createPendingRequest() {
    let resolve;
    let reject;

    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });

    return { promise, resolve, reject };
}

function normalizeComparableValue(value) {
    return typeof value === 'string' ? value.trim() : value ?? '';
}

function normalizeComparableObjectId(value) {
    if (!value) return '';
    return value.toString();
}

function readSourceText(filePath) {
    if (!filePath || filePath === 'imported-json' || !fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath, 'utf8');
}

async function findRecentMatchingCreateProject({
    name,
    style,
    language,
    premise,
    sourceText,
    initialChapterStructure,
    aiProvider,
    aiModel,
    imageStyle
}) {
    const candidates = await Project.find({
        name,
        style,
        language,
        createdAt: { $gte: new Date(Date.now() - (10 * 60 * 1000)) }
    }).sort({ createdAt: -1 }).limit(10);

    const normalizedPremise = normalizeComparableValue(premise);
    const normalizedAiProvider = normalizeComparableValue(aiProvider);
    const normalizedAiModel = normalizeComparableValue(aiModel);
    const normalizedImageStyle = normalizeComparableObjectId(imageStyle);
    const normalizedStructure = stableSerialize(initialChapterStructure || []);

    for (const candidate of candidates) {
        if (normalizeComparableValue(candidate.premise) !== normalizedPremise) continue;
        if (normalizeComparableValue(candidate.aiProvider) !== normalizedAiProvider) continue;
        if (normalizeComparableValue(candidate.aiModel) !== normalizedAiModel) continue;
        if (normalizeComparableObjectId(candidate.imageStyle) !== normalizedImageStyle) continue;
        if (stableSerialize(candidate.initialChapterStructure || []) !== normalizedStructure) continue;

        const candidateSourceText = readSourceText(candidate.originalFilePath);
        if (candidateSourceText == null) continue;
        if (candidateSourceText !== sourceText) continue;

        return candidate;
    }

    return null;
}

function safeUnlink(filePath) {
    if (!filePath) return;

    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        logProjectCreationError('source_cleanup_failed', {
            filePath,
            error: error.message
        });
    }
}

function logProjectCreation(event, details = {}) {
    console.log(`[PROJECT_CREATE] ${event}`, details);
}

function logProjectCreationError(event, details = {}) {
    console.error(`[PROJECT_CREATE] ${event}`, details);
}

const automationService = require('../services/automationService');

// POST /api/projects - Create a new project with a TXT file or pasted text
router.post('/', parseProjectCreateRequest, async (req, res) => {
    const startedAt = Date.now();
    const idempotencyKey = getIdempotencyKey(req);
    let filePath;
    let shouldCleanupFile = false;
    let requestIdentity;
    let pendingRequest;

    try {
        const requestBody = req.body || {};
        const { name, style, language, imageStyle, text, premise, initialChapterStructure, targetWordCount } = requestBody;
        const { updates: aiOverrides } = normalizeTextAiValues(req.body);
        const normalizedImageStyle = normalizeOptionalObjectId(imageStyle);

        logProjectCreation('request_received', {
            name: name || '(unnamed)',
            idempotencyKey: idempotencyKey || '(missing)',
            contentType: req.headers['content-type'] || 'unknown',
            source: req.file ? 'file' : text ? 'pasted_text' : 'unknown',
            hasFile: Boolean(req.file),
            hasText: Boolean(text),
            language: language || '(default)',
            style: style || '(missing)',
            aiProvider: aiOverrides.aiProvider || '(default)',
            aiModel: aiOverrides.aiModel || '(default)'
        });

        if (idempotencyKey) {
            const existingProject = await findProjectByIdempotencyKey(idempotencyKey);
            if (existingProject) {
                safeUnlink(req.file?.path);
                logProjectCreation('duplicate_request_reused', {
                    idempotencyKey,
                    projectId: existingProject._id.toString(),
                    name: existingProject.name,
                    durationMs: Date.now() - startedAt
                });
                return res.status(200).json(existingProject);
            }
        }

        if (normalizedImageStyle && !mongoose.Types.ObjectId.isValid(normalizedImageStyle)) {
            logProjectCreationError('validation_failed', {
                reason: 'invalid_image_style',
                imageStyle: normalizedImageStyle,
                name: name || '(unnamed)'
            });
            return res.status(400).json({ error: 'Invalid image style' });
        }

        // Handle file upload
        if (req.file) {
            filePath = req.file.path;
            shouldCleanupFile = true;
            logProjectCreation('source_prepared', {
                name: name || '(unnamed)',
                idempotencyKey: idempotencyKey || '(missing)',
                source: 'file',
                originalName: req.file.originalname,
                storedPath: filePath,
                sizeBytes: req.file.size
            });
        }
        // Handle pasted text
        else if (text) {
            // Create a file from the pasted text
            const fileName = `${Date.now()}-pasted-text.txt`;
            filePath = `uploads/${fileName}`;

            // Ensure uploads directory exists
            if (!fs.existsSync('uploads')) {
                fs.mkdirSync('uploads', { recursive: true });
            }

            // Write text to file
            fs.writeFileSync(filePath, text, 'utf8');
            shouldCleanupFile = true;

            logProjectCreation('source_prepared', {
                name: name || '(unnamed)',
                idempotencyKey: idempotencyKey || '(missing)',
                source: 'pasted_text',
                storedPath: filePath,
                textLength: text.length
            });
        }
        // No input provided
        else {
            logProjectCreationError('validation_failed', {
                reason: 'missing_source_content',
                name: name || '(unnamed)'
            });
            return res.status(400).json({ error: 'No file uploaded or text provided' });
        }

        let parsedChapters = [];
        if (initialChapterStructure) {
            try {
                parsedChapters = typeof initialChapterStructure === 'string' 
                    ? JSON.parse(initialChapterStructure) 
                    : initialChapterStructure;

                logProjectCreation('chapter_structure_parsed', {
                    name: name || '(unnamed)',
                    chapterCount: Array.isArray(parsedChapters) ? parsedChapters.length : 0
                });
            } catch (e) {
                logProjectCreationError('chapter_structure_parse_failed', {
                    name: name || '(unnamed)',
                    error: e.message
                });
            }
        }

        const sourceKind = req.file ? 'file' : 'pasted_text';
        const sourceText = req.file ? readSourceText(filePath) : text;
        const sourceHash = req.file
            ? hashValue(fs.readFileSync(filePath))
            : hashValue(text);
        const requestFingerprint = buildCreateFingerprint({
            name,
            style,
            language,
            premise,
            aiProvider: aiOverrides.aiProvider || null,
            aiModel: aiOverrides.aiModel || null,
            initialChapterStructure: parsedChapters,
            sourceKind,
            sourceHash,
            imageStyle: normalizedImageStyle
        });

        requestIdentity = `create:${idempotencyKey || requestFingerprint}`;

        const recentMatchingProject = await findRecentMatchingCreateProject({
            name,
            style,
            language,
            premise,
            sourceText,
            initialChapterStructure: parsedChapters,
            aiProvider: aiOverrides.aiProvider || null,
            aiModel: aiOverrides.aiModel || null,
            imageStyle: normalizedImageStyle
        });

        if (recentMatchingProject) {
            safeUnlink(filePath || req.file?.path);
            logProjectCreation('duplicate_content_reused', {
                projectId: recentMatchingProject._id.toString(),
                name: recentMatchingProject.name,
                durationMs: Date.now() - startedAt
            });
            return res.status(200).json(recentMatchingProject);
        }

        const recentProject = await findRecentProjectByFingerprint(requestFingerprint);
        if (recentProject) {
            safeUnlink(filePath || req.file?.path);
            logProjectCreation('duplicate_fingerprint_reused', {
                requestFingerprint,
                projectId: recentProject._id.toString(),
                name: recentProject.name,
                durationMs: Date.now() - startedAt
            });
            return res.status(200).json(recentProject);
        }

        if (activeProjectRequests.has(requestIdentity)) {
            safeUnlink(filePath || req.file?.path);
            const existingProject = await activeProjectRequests.get(requestIdentity);
            logProjectCreation('duplicate_inflight_reused', {
                idempotencyKey: idempotencyKey || '(missing)',
                requestFingerprint,
                projectId: existingProject._id.toString(),
                name: existingProject.name,
                durationMs: Date.now() - startedAt
            });
            return res.status(200).json(existingProject);
        }

        pendingRequest = createPendingRequest();
        activeProjectRequests.set(requestIdentity, pendingRequest.promise);

        const newProject = new Project({
            name,
            idempotencyKey,
            requestFingerprint,
            style,
            language,
            imageStyle: normalizedImageStyle,
            originalFilePath: filePath,
            status: 'new',
            premise,
            isShortStory: Array.isArray(parsedChapters) && parsedChapters.length === 1,
            targetWordCount: targetWordCount ? parseInt(targetWordCount, 10) : undefined,
            initialChapterStructure: parsedChapters,
            aiProvider: aiOverrides.aiProvider,
            aiModel: aiOverrides.aiModel
        });

        logProjectCreation('saving_project', {
            name: name || '(unnamed)',
            idempotencyKey: idempotencyKey || '(missing)',
            requestFingerprint,
            status: newProject.status,
            chapterCount: parsedChapters.length,
            hasPremise: Boolean(premise),
            imageStyle: normalizedImageStyle || '(none)'
        });

        await newProject.save();
        let persistedProject = newProject;

        if (idempotencyKey || requestFingerprint) {
            const dedupeState = {};

            if (idempotencyKey) {
                dedupeState.idempotencyKey = idempotencyKey;
            }

            if (requestFingerprint) {
                dedupeState.requestFingerprint = requestFingerprint;
            }

            persistedProject = await Project.findByIdAndUpdate(
                newProject._id,
                { $set: dedupeState },
                { new: true }
            );
        }

        shouldCleanupFile = false;
        pendingRequest.resolve(persistedProject);

        logProjectCreation('project_saved', {
            projectId: persistedProject._id.toString(),
            name: persistedProject.name,
            idempotencyKey: idempotencyKey || '(missing)',
            requestFingerprint,
            aiProvider: persistedProject.aiProvider || '(default)',
            aiModel: persistedProject.aiModel || '(default)',
            durationMs: Date.now() - startedAt
        });

        // Trigger full automation in background
        logProjectCreation('automation_dispatched', {
            projectId: persistedProject._id.toString(),
            name: persistedProject.name,
            idempotencyKey: idempotencyKey || '(missing)'
        });
        automationService.runFullAutomation(persistedProject._id);

        logProjectCreation('response_sent', {
            projectId: persistedProject._id.toString(),
            idempotencyKey: idempotencyKey || '(missing)',
            statusCode: 201,
            durationMs: Date.now() - startedAt
        });

        res.status(201).json(persistedProject);
    } catch (error) {
        pendingRequest?.reject(error);

        if (isDuplicateIdempotencyError(error) && idempotencyKey) {
            const existingProject = await findProjectByIdempotencyKey(idempotencyKey);
            safeUnlink(filePath || req.file?.path);

            if (existingProject) {
                logProjectCreation('duplicate_save_reused', {
                    idempotencyKey,
                    projectId: existingProject._id.toString(),
                    name: existingProject.name,
                    durationMs: Date.now() - startedAt
                });
                return res.status(200).json(existingProject);
            }
        }

        if (shouldCleanupFile) {
            safeUnlink(filePath || req.file?.path);
        }

        logProjectCreationError('request_failed', {
            name: req.body?.name || '(unnamed)',
            idempotencyKey: idempotencyKey || '(missing)',
            requestIdentity: requestIdentity || '(unassigned)',
            error: error.message,
            durationMs: Date.now() - startedAt,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to create project' });
    } finally {
        if (requestIdentity && activeProjectRequests.get(requestIdentity) === pendingRequest?.promise) {
            activeProjectRequests.delete(requestIdentity);
        }
    }
});

// POST /api/projects/import - Import a full project from JSON
router.post('/import', express.json({ limit: '50mb' }), async (req, res) => {
    const startedAt = Date.now();
    const idempotencyKey = getIdempotencyKey(req);
    let requestIdentity;
    let pendingRequest;
    console.log('Received import request');
    console.log('Request headers:', req.headers);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'null');
    
    try {
        const importData = req.body;
        
        if (!importData || Object.keys(importData).length === 0) {
            console.error('Empty request body');
            return res.status(400).json({ error: 'No JSON data provided' });
        }

        const requestFingerprint = buildImportFingerprint(importData);
        requestIdentity = `import:${idempotencyKey || requestFingerprint}`;

        if (idempotencyKey) {
            const existingProject = await findProjectByIdempotencyKey(idempotencyKey);
            if (existingProject) {
                logProjectCreation('import_duplicate_request_reused', {
                    idempotencyKey,
                    projectId: existingProject._id.toString(),
                    name: existingProject.name,
                    durationMs: Date.now() - startedAt
                });
                return res.status(200).json(existingProject);
            }
        }

        const recentProject = await findRecentProjectByFingerprint(requestFingerprint);
        if (recentProject) {
            logProjectCreation('import_duplicate_fingerprint_reused', {
                requestFingerprint,
                projectId: recentProject._id.toString(),
                name: recentProject.name,
                durationMs: Date.now() - startedAt
            });
            return res.status(200).json(recentProject);
        }

        if (activeProjectRequests.has(requestIdentity)) {
            const existingProject = await activeProjectRequests.get(requestIdentity);
            logProjectCreation('import_duplicate_inflight_reused', {
                idempotencyKey: idempotencyKey || '(missing)',
                requestFingerprint,
                projectId: existingProject._id.toString(),
                name: existingProject.name,
                durationMs: Date.now() - startedAt
            });
            return res.status(200).json(existingProject);
        }

        pendingRequest = createPendingRequest();
        activeProjectRequests.set(requestIdentity, pendingRequest.promise);

        const { project, bible, scenes } = importData;
        const { updates: importedAiOverrides } = normalizeTextAiValues(project || {});
        console.log('Import data keys:', Object.keys(importData));

        if (!project || !project.name) {
            console.error('Missing project data');
            return res.status(400).json({ error: 'Missing project data in JSON' });
        }

        console.log('Creating project:', project.name);

        // 1. Create Project
        const newProject = new Project({
            name: project.name,
            idempotencyKey,
            requestFingerprint,
            style: project.style || 'General',
            language: project.language || 'Português Brasileiro',
            premise: project.premise,
            originalFilePath: 'imported-json', // Placeholder since we are in memory
            status: 'ready', // Assume imported projects are ready
            initialChapterStructure: project.initialChapterStructure || [],
            aiProvider: importedAiOverrides.aiProvider,
            aiModel: importedAiOverrides.aiModel
        });

        // Handle Image Style if provided (by ID or Name)
        if (project.imageStyle) {
            console.log('Processing image style:', project.imageStyle);
            // If it looks like an ObjectId, use it
            if (mongoose.Types.ObjectId.isValid(project.imageStyle)) {
                newProject.imageStyle = project.imageStyle;
            } else {
                // Try to find by name
                const style = await ImageStyle.findOne({ name: project.imageStyle });
                if (style) {
                    newProject.imageStyle = style._id;
                    console.log('Found image style by name:', style.name);
                } else {
                    console.warn('Image style not found:', project.imageStyle);
                }
            }
        }

        await newProject.save();
        let persistedProject = newProject;

        if (idempotencyKey || requestFingerprint) {
            const dedupeState = {};

            if (idempotencyKey) {
                dedupeState.idempotencyKey = idempotencyKey;
            }

            if (requestFingerprint) {
                dedupeState.requestFingerprint = requestFingerprint;
            }

            persistedProject = await Project.findByIdAndUpdate(
                newProject._id,
                { $set: dedupeState },
                { new: true }
            );
        }

        pendingRequest.resolve(persistedProject);
        console.log('Project saved with ID:', persistedProject._id);

        // 2. Create Bible
        if (bible) {
            console.log('Creating Bible...');
            const newBible = new Bible({
                projectId: persistedProject._id,
                summary: bible.summary,
                premise: bible.premise,
                theCrucible: bible.theCrucible,
                characters: bible.characters || [],
                settings: bible.settings || [],
                chapters: bible.chapters || [],
                beats: bible.beats || []
            });
            await newBible.save();
            console.log('Bible saved');
        } else {
            console.warn('No bible data found in import');
        }

        // 3. Create Scenes
        if (scenes && Array.isArray(scenes)) {
            console.log(`Processing ${scenes.length} scenes...`);
            const sceneDocs = scenes.map(scene => ({
                projectId: persistedProject._id,
                beatId: scene.beatId,
                chapterNumber: scene.chapterNumber,
                title: scene.title,
                content: scene.content,
                summary: scene.summary,
                status: 'final', // Assume imported scenes are final
                generatedAt: new Date()
            }));
            
            if (sceneDocs.length > 0) {
                await Scene.insertMany(sceneDocs);
                console.log('Scenes saved');
            }
        } else {
            console.warn('No scenes data found or invalid format');
        }

        res.status(201).json(persistedProject);

    } catch (error) {
        pendingRequest?.reject(error);

        if (isDuplicateIdempotencyError(error) && idempotencyKey) {
            const existingProject = await findProjectByIdempotencyKey(idempotencyKey);

            if (existingProject) {
                logProjectCreation('import_duplicate_save_reused', {
                    idempotencyKey,
                    projectId: existingProject._id.toString(),
                    name: existingProject.name,
                    durationMs: Date.now() - startedAt
                });
                return res.status(200).json(existingProject);
            }
        }

        console.error('Error importing project:', error);
        if (error.name === 'ValidationError') {
             console.error('Validation Error Details:', JSON.stringify(error.errors, null, 2));
        }
        res.status(500).json({ error: 'Failed to import project: ' + error.message });
    } finally {
        if (requestIdentity && activeProjectRequests.get(requestIdentity) === pendingRequest?.promise) {
            activeProjectRequests.delete(requestIdentity);
        }
    }
});

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET /api/projects/:id - Get a single project
router.get('/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// PUT /api/projects/:id - Update project
router.put('/:id', express.json(), async (req, res) => {
    try {
        const { updates, unset } = normalizeTextAiValues(req.body);
        const updateQuery = {};

        if (Object.keys(updates).length > 0) {
            updateQuery.$set = updates;
        }
        if (Object.keys(unset).length > 0) {
            updateQuery.$unset = unset;
        }

        const project = await Project.findByIdAndUpdate(req.params.id, Object.keys(updateQuery).length > 0 ? updateQuery : updates, {
            new: true,
            runValidators: true
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE /api/projects/:id - Delete project and all related data
router.delete('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Find the project first to get file path
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Delete all related data
        await Promise.all([
            // Delete Bible
            Bible.deleteMany({ projectId: projectId }),
            // Delete Scenes
            Scene.deleteMany({ projectId: projectId }),
            // Remove project from any anthologies
            Anthology.updateMany(
                { projectIds: projectId },
                { $pull: { projectIds: projectId } }
            )
        ]);

        // Delete the uploaded file if it exists
        if (project.originalFilePath && project.originalFilePath !== 'imported-json') {
            const filePath = path.join(__dirname, '..', project.originalFilePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Finally, delete the project itself
        await Project.findByIdAndDelete(projectId);

        res.json({ message: 'Project deleted successfully', deletedProjectId: projectId });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project: ' + error.message });
    }
});

// POST /api/projects/:id/resume-automation — Resume a stalled or partial automation
router.post('/:id/resume-automation', express.json(), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const resumable = ['bible_ready', 'generating_media', 'writing'].includes(project.status);
        if (!resumable) {
            return res.status(400).json({
                error: `Project status '${project.status}' cannot be resumed. Only bible_ready, generating_media or writing projects can be resumed.`
            });
        }

        logProjectCreation('automation_resume_dispatched', {
            projectId: project._id.toString(),
            name: project.name,
            currentStatus: project.status
        });

        automationService.runFullAutomation(project._id, { resume: true });
        res.json({ message: 'Automation resuming', projectId: project._id, status: project.status });
    } catch (error) {
        console.error('Resume automation error:', error);
        res.status(500).json({ error: 'Failed to resume automation' });
    }
});

const pdfService = require('../services/pdfService');
const imageService = require('../services/imageService');

// GET /api/projects/:id/export-pdf
router.get('/:id/export-pdf', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId: project._id });
        const scenes = await Scene.find({ projectId: project._id }).sort({ beatId: 1 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

        await pdfService.generateProjectPDF(project, bible, scenes, res);
    } catch (error) {
        console.error('PDF Export Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// POST /api/projects/anthology - Create an anthology PDF
// POST /api/projects/anthology - Create matching anthology PDF and save it
router.post('/anthology', express.json(), async (req, res) => {
    try {
        const { title, subtitle, projectIds, coverPrompt } = req.body;

        if (!projectIds || projectIds.length === 0) {
            return res.status(400).json({ error: 'No projects selected' });
        }

        // 1. Fetch data for all projects
        const projectsData = [];
        for (const id of projectIds) {
            const project = await Project.findById(id);
            if (project) {
                const bible = await Bible.findOne({ projectId: project._id });
                const scenes = await Scene.find({ projectId: project._id }).sort({ beatId: 1 });
                projectsData.push({ project, bible, scenes });
            }
        }

        // 2. Generate Cover Image
        let coverImageUrl = null;
        if (coverPrompt) {
            try {
                let enhancedPrompt = coverPrompt;
                if (req.body.imageStyle) {
                    const style = await ImageStyle.findById(req.body.imageStyle);
                    if (style) {
                        enhancedPrompt = `${coverPrompt}, ${style.prompt}`;
                    }
                }
                enhancedPrompt += ". Portrait aspect ratio 9:16.";
                coverImageUrl = await imageService.generateCharacterImageSafe(enhancedPrompt, "", '9:16');
            } catch (err) {
                console.error("Anthology Cover Generation Error:", err);
            }
        }

        // 3. Prepare paths for saving
        const fileName = `${Date.now()}_${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const pdfPath = `uploads/anthologies/${fileName}`;
        const fullPdfPath = path.join(__dirname, '..', pdfPath);

        // Ensure directory exists
        const anthologyDir = path.join(__dirname, '../uploads/anthologies');
        if (!fs.existsSync(anthologyDir)) {
            fs.mkdirSync(anthologyDir, { recursive: true });
        }

        // 4. Create database record
        const anthology = new Anthology({
            title,
            subtitle,
            projectIds,
            imageStyle: req.body.imageStyle,
            coverImageUrl,
            coverPrompt,
            pdfPath,
            status: 'ready'
        });

        // 5. Generate PDF (save to disk and also stream to response for immediate download)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await pdfService.generateAnthologyPDF(title, coverImageUrl, projectsData, res, fullPdfPath, subtitle);

        // Save anthology record after PDF generation attempt
        await anthology.save();

    } catch (error) {
        console.error('Anthology Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate anthology' });
    }
});

// GET /api/anthologies - List all anthologies
router.get('/lists/anthologies', async (req, res) => {
    try {
        const anthologies = await Anthology.find()
            .populate('projectIds', 'name')
            .sort({ createdAt: -1 });
        res.json(anthologies);
    } catch (error) {
        console.error('Error fetching anthologies:', error);
        res.status(500).json({ error: 'Failed to fetch anthologies' });
    }
});

// GET /api/anthologies/:id/download - Download saved PDF
router.get('/anthologies/:id/download', async (req, res) => {
    try {
        const anthology = await Anthology.findById(req.params.id);
        if (!anthology || !anthology.pdfPath) {
            return res.status(404).json({ error: 'Anthology or PDF not found' });
        }

        const fullPath = path.join(__dirname, '..', anthology.pdfPath);
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'PDF file not found on server' });
        }

        res.download(fullPath, `${anthology.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download anthology' });
    }
});

// POST /api/projects/anthology/preview-cover - Just generate and return the cover image
router.post('/anthology/preview-cover', express.json(), async (req, res) => {
    try {
        const { coverPrompt, imageStyleId } = req.body;
        if (!coverPrompt) return res.status(400).json({ error: 'No prompt provided' });

        let enhancedPrompt = coverPrompt;
        if (imageStyleId) {
            const style = await ImageStyle.findById(imageStyleId);
            if (style) {
                enhancedPrompt = `${coverPrompt}, ${style.prompt}`;
            }
        }

        enhancedPrompt += ". Aspect ratio 9:16 portrait.";
        const imageUrl = await imageService.generateCharacterImage(enhancedPrompt, "", '9:16');

        res.json({ imageUrl });
    } catch (error) {
        console.error('Cover preview error:', error);
        res.status(500).json({ error: 'Failed to generate cover preview' });
    }
});

// GET /api/anthologies/:id - Get single anthology for editing
router.get('/anthologies/:id', async (req, res) => {
    try {
        const anthology = await Anthology.findById(req.params.id);
        if (!anthology) return res.status(404).json({ error: 'Anthology not found' });
        res.json(anthology);
    } catch (error) {
        console.error('Error fetching anthology:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// PUT /api/anthologies/:id - Update anthology and optionally regenerate PDF
router.put('/anthologies/:id', express.json(), async (req, res) => {
    try {
        const { title, subtitle, projectIds, coverPrompt, coverImageUrl, regeneratePdf } = req.body;
        const anthology = await Anthology.findById(req.params.id);
        if (!anthology) return res.status(404).json({ error: 'Anthology not found' });

        anthology.title = title || anthology.title;
        anthology.subtitle = subtitle !== undefined ? subtitle : anthology.subtitle;
        anthology.projectIds = projectIds || anthology.projectIds;
        anthology.coverPrompt = coverPrompt || anthology.coverPrompt;
        anthology.imageStyle = req.body.imageStyle || anthology.imageStyle;
        anthology.coverImageUrl = coverImageUrl || anthology.coverImageUrl;

        if (regeneratePdf) {
            // Fetch data for all projects
            const projectsData = [];
            for (const id of anthology.projectIds) {
                const project = await Project.findById(id);
                if (project) {
                    const bible = await Bible.findOne({ projectId: project._id });
                    const scenes = await Scene.find({ projectId: project._id }).sort({ beatId: 1 });
                    projectsData.push({ project, bible, scenes });
                }
            }

            const fileName = `${Date.now()}_${anthology.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            const pdfPath = `uploads/anthologies/${fileName}`;
            const fullPdfPath = path.join(__dirname, '..', pdfPath);

            // Generate new PDF
            await pdfService.generateAnthologyPDF(anthology.title, anthology.coverImageUrl, projectsData, null, fullPdfPath, anthology.subtitle);

            anthology.pdfPath = pdfPath;
        }

        await anthology.save();
        res.json(anthology);
    } catch (error) {
        console.error('Error updating anthology:', error);
        res.status(500).json({ error: 'Failed to update anthology' });
    }
});

// POST /api/projects/:id/analyze-chapter - Analyze a chapter
router.post('/:id/analyze-chapter', express.json(), async (req, res) => {
    try {
        const { chapterNumber } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId: project._id });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        const chapter = bible.chapters.find(c => c.chapterNumber === chapterNumber);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        // Get style data
        const NarrativeStyle = require('../models/NarrativeStyle');
        const styleData = await NarrativeStyle.findOne({ name: project.style });

        const aiService = require('../services/aiService');
        const analysis = await aiService.analyzeChapter(
            chapter,
            bible,
            styleData,
            project.language || 'Português Brasileiro',
            project
        );

        // Save the analysis in the chapter
        chapter.analysis = analysis;
        chapter.analysisDate = new Date();
        await bible.save();

        res.json({ analysis, chapter });
    } catch (error) {
        console.error('Error analyzing chapter:', error);
        res.status(500).json({ error: 'Failed to analyze chapter: ' + error.message });
    }
});

// POST /api/projects/:id/analyze-all-chapters - Analyze all chapters in batch
router.post('/:id/analyze-all-chapters', express.json(), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId: project._id });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        if (!bible.chapters || bible.chapters.length === 0) {
            return res.status(400).json({ error: 'No chapters found in this project' });
        }

        // Get style data
        const NarrativeStyle = require('../models/NarrativeStyle');
        const styleData = await NarrativeStyle.findOne({ name: project.style });

        const aiService = require('../services/aiService');
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Process each chapter sequentially to avoid overwhelming the API
        for (const chapter of bible.chapters) {
            try {
                console.log(`Analyzing chapter ${chapter.chapterNumber}: ${chapter.title}`);
                
                const analysis = await aiService.analyzeChapter(
                    chapter,
                    bible,
                    styleData,
                    project.language || 'Português Brasileiro',
                    project
                );

                chapter.analysis = analysis;
                chapter.analysisDate = new Date();
                successCount++;

                results.push({
                    chapterNumber: chapter.chapterNumber,
                    title: chapter.title,
                    success: true
                });
            } catch (error) {
                console.error(`Error analyzing chapter ${chapter.chapterNumber}:`, error);
                errorCount++;
                results.push({
                    chapterNumber: chapter.chapterNumber,
                    title: chapter.title,
                    success: false,
                    error: error.message
                });
            }
        }

        // Save all changes
        await bible.save();

        res.json({
            message: `Analysis completed for ${successCount} out of ${bible.chapters.length} chapters`,
            successCount,
            errorCount,
            results
        });
    } catch (error) {
        console.error('Error analyzing all chapters:', error);
        res.status(500).json({ error: 'Failed to analyze chapters: ' + error.message });
    }
});

router.get('/:id/chapters/:chapterNumber/analysis/export-pdf', async (req, res) => {
    try {
        const chapterNumber = parseInt(req.params.chapterNumber, 10);
        if (Number.isNaN(chapterNumber)) {
            return res.status(400).json({ error: 'Número de capítulo inválido' });
        }

        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId: project._id });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        const chapter = bible.chapters.find(c => c.chapterNumber === chapterNumber);
        if (!chapter || !chapter.analysis) {
            return res.status(404).json({ error: 'Chapter analysis not found' });
        }

        const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}-capitulo-${chapterNumber}-analise.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await pdfService.generateChapterAnalysisPDF(project, chapter, res);
    } catch (error) {
        console.error('Chapter analysis PDF error:', error);
        res.status(500).json({ error: 'Failed to export chapter analysis' });
    }
});

module.exports = router;
