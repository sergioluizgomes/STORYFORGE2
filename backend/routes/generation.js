const express = require('express');
const router = express.Router();
router.use(express.json());
const Project = require('../models/Project');
const Bible = require('../models/Bible');
const aiService = require('../services/aiService');
const imageService = require('../services/imageService');
const { listProviderModels } = require('../services/textGenerationService');
const {
    getGlobalTextDefaults,
    getProviderDefaultModel,
    listTextProviders,
    normalizeProvider,
    resolveTextGenerationConfig
} = require('../services/textModelConfig');

router.get('/text-settings/:projectId', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        res.json({
            providers: listTextProviders(),
            defaults: getGlobalTextDefaults(),
            project: {
                aiProvider: project.aiProvider || '',
                aiModel: project.aiModel || ''
            },
            resolved: resolveTextGenerationConfig(project)
        });
    } catch (error) {
        console.error('Text settings fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch text settings' });
    }
});

router.get('/providers/:provider/models', async (req, res) => {
    try {
        const provider = normalizeProvider(req.params.provider);
        if (!provider) {
            return res.status(400).json({ error: 'Unsupported provider' });
        }

        const models = await listProviderModels(provider);
        res.json({
            provider,
            defaultModel: getProviderDefaultModel(provider),
            models
        });
    } catch (error) {
        console.error('Provider model discovery error:', error);
        res.status(503).json({ error: error.message });
    }
});

// POST /api/generate/bible/:projectId
router.post('/bible/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const project = await Project.findById(projectId);

        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        // Only generate bible from text files, not imported projects
        if (!project.originalFilePath || project.originalFilePath === 'imported-json') {
            return res.status(400).json({ error: 'Cannot generate bible for imported projects. Data already exists in database.' });
        }

        // Update status
        project.status = 'analyzing';
        await project.save();

        // 1. Read File
        const text = await aiService.readTextFile(project.originalFilePath);

        // 2. Analyze Original (Abstraction Step)
        console.log(`Analyzing project ${projectId} source text in ${project.language}...`);
        const analysis = await aiService.analyzeStoryStructure(text, project.language, project);

        // 3. Generate Bible (Adaptation Step)
        console.log(`Generating bible for style: ${project.style} in ${project.language}...`);
        const bibleData = await aiService.generateStoryBible(
            analysis, 
            project.style, 
            project.language,
            project.initialChapterStructure,
            project.premise,
            project
        );

        // bibleData is now guaranteed to be valid JSON with the correct structure thanks to responseSchema
        const { characters, settings, chapters, summary, style_notes, premise, theCrucible } = bibleData;

        // 4. Save Bible to DB
        let bible = await Bible.findOne({ projectId });

        const mappedCharacters = characters.map(c => ({
            name: c.new_name,
            role: c.role,
            description: c.description,
            motivation: c.motivation,
            visualDescription: c.visual_description,
            archetype: c.archetype || c.original_name,
            mythicArchetype: c.mythicArchetype,
            rulingPassion: c.rulingPassion,
            theWound: c.theWound,
            specialTalent: c.specialTalent
        }));

        const mappedSettings = settings.map(s => ({
            name: s.new_name,
            type: 'Location',
            description: s.description,
            atmosphere: style_notes
        }));

        const mappedChapters = chapters ? chapters.map(c => ({
            chapterNumber: c.chapterNumber,
            title: c.title,
            type: c.type,
            aiSummary: c.aiSummary,
            mythicStage: c.mythicStage,
            beats: c.beats.map(b => ({
                id: b.id,
                title: b.title,
                description: b.description,
                type: 'Beat'
            }))
        })) : [];

        // Flatten beats for backward compatibility and easy access
        const allBeats = [];
        if (mappedChapters.length > 0) {
            mappedChapters.forEach(c => {
                c.beats.forEach(b => allBeats.push(b));
            });
        } else if (bibleData.beats) {
             bibleData.beats.forEach(b => allBeats.push({
                id: b.id,
                title: b.title,
                description: b.description,
                type: 'Beat'
             }));
        }

        // Force plain objects via JSON round-trip
        const cleanSettings = JSON.parse(JSON.stringify(mappedSettings));
        const cleanChapters = JSON.parse(JSON.stringify(mappedChapters));
        const cleanBeats = JSON.parse(JSON.stringify(allBeats));
        const cleanCharacters = JSON.parse(JSON.stringify(mappedCharacters));

        if (bible) {
            bible.summary = summary;
            bible.premise = premise;
            bible.theCrucible = theCrucible;
            bible.characters = cleanCharacters;
            bible.settings = cleanSettings;
            bible.chapters = cleanChapters;
            bible.beats = cleanBeats;
        } else {
            console.log("Creating new Bible instance...");

            const bibleData = {
                projectId,
                summary,
                premise,
                theCrucible,
                characters: cleanCharacters,
                settings: cleanSettings,
                chapters: cleanChapters,
                beats: cleanBeats
            };

            console.log("bibleData.settings Array.isArray:", Array.isArray(bibleData.settings));
            console.log("bibleData.settings[0]:", bibleData.settings[0]);

            bible = new Bible(bibleData);
        }

        await bible.save();

        // Update Project Status
        project.status = 'bible_ready';
        await project.save();

        res.json({ message: 'Bible generated successfully', bible });

    } catch (error) {
        console.error('Generation Flow Error:', error);
        res.status(500).json({ error: error.message });

        // Reset status on error
        try {
            await Project.findByIdAndUpdate(req.params.projectId, { status: 'new' });
        } catch (e) { }
    }
});

// GET /api/generate/bible/:projectId
router.get('/bible/:projectId', async (req, res) => {
    try {
        const bible = await Bible.findOne({ projectId: req.params.projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });
        res.json(bible);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bible' });
    }
});

// POST /api/generate/character-background
router.post('/character-background', async (req, res) => {
    try {
        const { projectId, character, userPrompt } = req.body;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Get context from Bible instead of reading file
        const bible = await Bible.findOne({ projectId });
        const context = bible ? `${bible.premise || ''} ${bible.summary || ''}` : project.premise || '';

        const result = await aiService.generateCharacterBackground(
            character,
            context,
            project.style,
            userPrompt,
            project
        );

        res.json({
            background: result.background,
            visualDescription: result.visual_description
        });
    } catch (error) {
        console.error('Character Background Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// POST /api/generate/character-image
router.post('/character-image', async (req, res) => {
    try {
        const { prompt, projectId } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let stylePrompt = "";
        if (projectId) {
            const project = await Project.findById(projectId).populate('imageStyle');
            if (project && project.imageStyle) {
                stylePrompt = project.imageStyle.prompt;
            }
        }

        const imageUrl = await imageService.generateCharacterImage(prompt, stylePrompt);
        res.json({ imageUrl });
    } catch (error) {
        console.error('Character Image Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/generate/bible/:projectId/character/:index
router.put('/bible/:projectId/character/:index', async (req, res) => {
    try {
        const { projectId, index } = req.params;
        const updates = req.body;

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        if (!bible.characters[index]) return res.status(404).json({ error: 'Character not found' });

        // Update character fields
        Object.assign(bible.characters[index], updates);

        await bible.save();
        res.json(bible);
    } catch (error) {
        console.error('Update Character Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/generate/location-background
router.post('/location-background', async (req, res) => {
    try {
        const { projectId, location, userPrompt } = req.body;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Get context from Bible instead of reading file
        const bible = await Bible.findOne({ projectId });
        const context = bible ? `${bible.premise || ''} ${bible.summary || ''}` : project.premise || '';

        const result = await aiService.generateLocationBackground(
            location,
            context,
            project.style,
            userPrompt,
            project
        );

        res.json({
            description: result.description,
            visualDescription: result.visual_description
        });
    } catch (error) {
        console.error('Location Background Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/generate/location-image
router.post('/location-image', async (req, res) => {
    try {
        const { prompt, projectId } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let stylePrompt = "";
        if (projectId) {
            const project = await Project.findById(projectId).populate('imageStyle');
            if (project && project.imageStyle) {
                stylePrompt = project.imageStyle.prompt;
            }
        }

        // Reuse the generic image generator
        const imageUrl = await imageService.generateCharacterImage(prompt, stylePrompt, '21:9');
        res.json({ imageUrl });
    } catch (error) {
        console.error('Location Image Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/generate/bible/:projectId/location/:index
router.put('/bible/:projectId/location/:index', async (req, res) => {
    try {
        const { projectId, index } = req.params;
        const updates = req.body;

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        if (!bible.settings[index]) return res.status(404).json({ error: 'Location not found' });

        // Update location fields
        Object.assign(bible.settings[index], updates);

        await bible.save();
        res.json(bible);
    } catch (error) {
        console.error('Update Location Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/generate/beat-details
router.post('/beat-details', async (req, res) => {
    try {
        const { projectId, beat, userPrompt } = req.body;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Get context from Bible instead of reading file
        const bible = await Bible.findOne({ projectId });
        const context = bible ? `${bible.premise || ''} ${bible.summary || ''}` : project.premise || '';

        const result = await aiService.generateBeatDetails(
            beat,
            context,
            project.style,
            userPrompt,
            project
        );

        res.json({
            description: result.description,
            visualDescription: result.visual_description
        });
    } catch (error) {
        console.error('Beat Details Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/generate/beat-image
router.post('/beat-image', async (req, res) => {
    try {
        const { prompt, projectId } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let stylePrompt = "";
        if (projectId) {
            const project = await Project.findById(projectId).populate('imageStyle');
            if (project && project.imageStyle) {
                stylePrompt = project.imageStyle.prompt;
            }
        }

        // Reuse the generic image generator with cinematic 21:9 aspect for beats
        const imageUrl = await imageService.generateCharacterImage(prompt, stylePrompt, '21:9');
        res.json({ imageUrl });
    } catch (error) {
        console.error('Beat Image Generation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/generate/chapter-beats-enhanced
router.post('/chapter-beats-enhanced', async (req, res) => {
    try {
        const { projectId, chapterNumber, instruction } = req.body;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        // Find the chapter
        const chapter = bible.chapters?.find(c => c.chapterNumber === chapterNumber);
        if (!chapter || !chapter.beats || chapter.beats.length === 0) {
            return res.status(404).json({ error: 'Chapter or beats not found' });
        }

        const context = `${bible.premise || ''} ${bible.summary || ''}`;
        const beatsToEnhance = chapter.beats;
        const enhancedBeats = [];

        // Process each beat
        for (const beat of beatsToEnhance) {
            try {
                const result = await aiService.generateBeatDetails(
                    beat,
                    context,
                    project.style,
                    instruction || '',
                    project
                );

                // Update the beat in the bible
                const beatId = beat.id;
                
                // Update in flat array
                if (Array.isArray(bible.beats)) {
                    const fidx = bible.beats.findIndex(b => String(b.id) === String(beatId));
                    if (fidx !== -1) {
                        bible.beats[fidx].description = result.description;
                        bible.beats[fidx].visualDescription = result.visual_description;
                    }
                }

                // Update in chapter
                if (Array.isArray(bible.chapters)) {
                    for (let ci = 0; ci < bible.chapters.length; ci++) {
                        const ch = bible.chapters[ci];
                        if (!Array.isArray(ch.beats)) continue;
                        const bi = ch.beats.findIndex(b => String(b.id) === String(beatId));
                        if (bi !== -1) {
                            ch.beats[bi].description = result.description;
                            ch.beats[bi].visualDescription = result.visual_description;
                        }
                    }
                }

                enhancedBeats.push({
                    id: beatId,
                    title: beat.title,
                    description: result.description,
                    visualDescription: result.visual_description
                });
            } catch (error) {
                console.error(`Error enhancing beat ${beat.id}:`, error);
                // Continue with next beat even if one fails
            }
        }

        await bible.save();
        res.json({ 
            count: enhancedBeats.length,
            beats: enhancedBeats,
            bible
        });
    } catch (error) {
        console.error('Chapter Beats Enhancement Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/generate/bible/:projectId/beat/:index
router.put('/bible/:projectId/beat/:index', async (req, res) => {
    try {
        const { projectId, index } = req.params;
        const updates = req.body;

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });
        // Try to locate and update the beat in either the flat `bible.beats` array
        // or inside `bible.chapters[].beats`. After updating we synchronize both
        // locations so the returned bible is consistent for the frontend.
        let updated = false;
        let targetId = null;

        // 1) Try flat beats array by numeric index
        const numericIndex = Number(index);
        if (!Number.isNaN(numericIndex) && Array.isArray(bible.beats) && bible.beats[numericIndex]) {
            Object.assign(bible.beats[numericIndex], updates);
            updated = true;
            targetId = bible.beats[numericIndex].id;
        }

        // 2) If not updated, try finding by beat `id` in flat array
        if (!updated && Array.isArray(bible.beats)) {
            const byIdIdx = bible.beats.findIndex(b => String(b.id) === String(index));
            if (byIdIdx !== -1) {
                Object.assign(bible.beats[byIdIdx], updates);
                updated = true;
                targetId = bible.beats[byIdIdx].id;
            }
        }

        // 3) If still not updated, search inside chapters' beats
        if (!updated && Array.isArray(bible.chapters)) {
            for (let ci = 0; ci < bible.chapters.length; ci++) {
                const chapter = bible.chapters[ci];
                if (!Array.isArray(chapter.beats)) continue;
                const bi = chapter.beats.findIndex(b => String(b.id) === String(index));
                if (bi !== -1) {
                    Object.assign(chapter.beats[bi], updates);
                    updated = true;
                    targetId = chapter.beats[bi].id;
                    break;
                }
            }
        }

        if (!updated) {
            return res.status(404).json({ error: 'Beat not found' });
        }

        // 4) Synchronize both flat `beats` and nested chapter beats using `targetId`
        if (targetId != null) {
            // Update flat array
            if (Array.isArray(bible.beats)) {
                const fidx = bible.beats.findIndex(b => String(b.id) === String(targetId));
                if (fidx !== -1) Object.assign(bible.beats[fidx], updates);
            }

            // Update all chapters that may contain this beat
            if (Array.isArray(bible.chapters)) {
                for (let ci = 0; ci < bible.chapters.length; ci++) {
                    const chapter = bible.chapters[ci];
                    if (!Array.isArray(chapter.beats)) continue;
                    const bi = chapter.beats.findIndex(b => String(b.id) === String(targetId));
                    if (bi !== -1) Object.assign(chapter.beats[bi], updates);
                }
            }
        }

        await bible.save();
        res.json(bible);
    } catch (error) {
        console.error('Update Beat Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const NarrativeStyle = require('../models/NarrativeStyle');

// POST /api/generate/analyze-chapter/:projectId/:chapterNumber
// Run editorial analysis on a chapter and persist the result in Bible.chapters[].analysis
router.post('/analyze-chapter/:projectId/:chapterNumber', async (req, res) => {
    try {
        const { projectId, chapterNumber } = req.params;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });

        const chapterIndex = bible.chapters.findIndex(c => c.chapterNumber === Number(chapterNumber));
        if (chapterIndex === -1) return res.status(404).json({ error: 'Chapter not found' });

        const chapterData = bible.chapters[chapterIndex];

        // Load narrative style for richer analysis context
        const styleData = await NarrativeStyle.findOne({ name: project.style }).lean();

        console.log(`[ANALYZE CHAPTER] Analyzing chapter ${chapterNumber} for project ${project.name}...`);
        const analysis = await aiService.analyzeChapter(chapterData, bible, styleData, project.language, project);

        // Persist analysis back on the chapter
        bible.chapters[chapterIndex].analysis = analysis;
        bible.chapters[chapterIndex].analysisDate = new Date();
        await bible.save();

        res.json({
            chapterNumber: Number(chapterNumber),
            analysis,
            analysisDate: bible.chapters[chapterIndex].analysisDate
        });
    } catch (error) {
        console.error('Chapter Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
