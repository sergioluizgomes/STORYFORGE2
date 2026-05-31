const express = require('express');
const router = express.Router();
router.use(express.json());
const Project = require('../models/Project');
const Bible = require('../models/Bible');
const Scene = require('../models/Scene');
const aiService = require('../services/aiService');
const { getBookBriefByProjectId } = require('../services/bookBriefService');
const { findChapterForBeat, resolveChapterNumberForBeat } = require('../services/storyStructureService');
const { safeErrorForLog } = require('../utils/safeLog');

function countConfiguredBookBriefFields(bookBrief) {
    if (!bookBrief) return 0;

    const source = typeof bookBrief.toObject === 'function' ? bookBrief.toObject() : bookBrief;
    return [
        'genre',
        'subgenre',
        'targetAudience',
        'language',
        'tone',
        'narrativeVoice',
        'targetWordCount',
        'targetChapterCount',
        'monetizationMode',
        'seriesName',
        'bookNumber',
        'aiDisclosure',
        'humanReviewStatus',
        'contentGuidelines',
        'mustInclude',
        'mustAvoid',
        'comparableTitles',
        'keywords'
    ].filter((field) => {
        const value = source[field];
        if (Array.isArray(value)) return value.length > 0;
        if (value && typeof value === 'object') return Object.keys(value).length > 0;
        return value !== undefined && value !== null && String(value).trim().length > 0;
    }).length;
}

// GET /api/scenes/project/:projectId
// Get all scenes for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const scenes = await Scene.find({ projectId: req.params.projectId }).sort({ chapterNumber: 1, beatId: 1 });
        res.json(scenes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch scenes' });
    }
});

// POST /api/scenes/generate
// Generate a specific scene
router.post('/generate', async (req, res) => {
    try {
        const { projectId, beatId, direction } = req.body;

        // 1. Fetch Context
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });
        const bookBrief = await getBookBriefByProjectId(projectId);
        console.log('[SCENE GENERATE] BookBrief prompt context', {
            projectId,
            bookBriefExists: Boolean(bookBrief),
            configuredFieldCount: countConfiguredBookBriefFields(bookBrief)
        });

        console.log(`[SCENE GENERATE] Looking for beatId: ${beatId} (type: ${typeof beatId})`);
        console.log(`[SCENE GENERATE] bible.beats exists: ${!!bible.beats}, length: ${bible.beats?.length || 0}`);
        console.log(`[SCENE GENERATE] bible.chapters exists: ${!!bible.chapters}, length: ${bible.chapters?.length || 0}`);
        
        if (bible.beats && bible.beats.length > 0) {
            console.log(`[SCENE GENERATE] Sample beat IDs from bible.beats:`, bible.beats.slice(0, 3).map(b => `${b.id} (${typeof b.id})`));
        }
        
        if (bible.chapters && bible.chapters.length > 0) {
            console.log(`[SCENE GENERATE] Sample chapter beats:`);
            bible.chapters.slice(0, 2).forEach(ch => {
                if (ch.beats && ch.beats.length > 0) {
                    console.log(`  Chapter ${ch.chapterNumber}: beats ${ch.beats.slice(0, 3).map(b => `${b.id} (${typeof b.id})`)}`);
                }
            });
        }

        // Try to find beat in flat beats array first
        let beat = bible.beats?.find(b => String(b.id) === String(beatId));
        
        // If not found, search in chapters
        if (!beat && bible.chapters) {
            console.log(`[SCENE GENERATE] Beat not found in bible.beats, searching in chapters...`);
            for (const chapter of bible.chapters) {
                if (chapter.beats) {
                    beat = chapter.beats.find(b => String(b.id) === String(beatId));
                    if (beat) {
                        console.log(`[SCENE GENERATE] ✓ Found beat in chapter ${chapter.chapterNumber}`);
                        break;
                    }
                }
            }
        } else if (beat) {
            console.log(`[SCENE GENERATE] ✓ Found beat in bible.beats`);
        }
        
        if (!beat) {
            console.error(`[SCENE GENERATE] ✗ Beat ${beatId} not found in bible.beats or bible.chapters`);
            return res.status(404).json({ error: 'Beat not found in Bible' });
        }

        const chapter = findChapterForBeat(bible, beatId);
        const chapterNumber = resolveChapterNumberForBeat(bible, beatId);
        if (chapterNumber === undefined) {
            console.log(`[SCENE GENERATE] Chapter number not found for beat ${beatId}; saving scene without chapterNumber`);
        }

        // 1.1 Fetch Previous Scene Summaries (Context Chaining — layered)
        const previousScenes = await Scene.find({
            projectId,
            beatId: { $lt: beatId },
            summary: { $exists: true, $ne: "" }
        }).sort({ beatId: 1 });

        // Build a layered context: recent scenes in full, older ones compressed
        const sceneHistory = previousScenes.map(s => ({
            beatId: s.beatId,
            title: s.title || '',
            summary: s.summary || ''
        }));
        const previousContext = aiService.buildLayeredContext(sceneHistory);

        // 1.2 Fetch Next Beats (Future Context for narrative direction)
        let nextBeats = [];
        console.log(`[SCENE GENERATE] Searching for beats after beatId ${beatId}...`);
        console.log(`[SCENE GENERATE] bible.chapters exists: ${!!bible.chapters}, length: ${bible.chapters?.length || 0}`);
        
        if (bible.chapters) {
            // Find current chapter and get next beats
            for (const chapter of bible.chapters) {
                if (chapter.beats) {
                    const currentBeatIndex = chapter.beats.findIndex(b => String(b.id) === String(beatId));
                    if (currentBeatIndex !== -1) {
                        console.log(`[SCENE GENERATE] Found beat at index ${currentBeatIndex} in chapter ${chapter.chapterNumber}`);
                        // Get next 2-3 beats from current chapter
                        nextBeats = chapter.beats.slice(currentBeatIndex + 1, currentBeatIndex + 4);
                        console.log(`[SCENE GENERATE] Found ${nextBeats.length} beats in current chapter`);
                        // If we need more beats and there's a next chapter, add some from there
                        if (nextBeats.length < 3) {
                            const nextChapter = bible.chapters.find(c => c.chapterNumber === chapter.chapterNumber + 1);
                            if (nextChapter && nextChapter.beats) {
                                const additionalBeats = nextChapter.beats.slice(0, 3 - nextBeats.length);
                                console.log(`[SCENE GENERATE] Adding ${additionalBeats.length} beats from next chapter ${nextChapter.chapterNumber}`);
                                nextBeats = [...nextBeats, ...additionalBeats];
                            }
                        }
                        break;
                    }
                }
            }
        } else if (bible.beats) {
            // Fallback to flat beats array
            console.log(`[SCENE GENERATE] Using flat beats array, length: ${bible.beats.length}`);
            const currentIndex = bible.beats.findIndex(b => String(b.id) === String(beatId));
            if (currentIndex !== -1) {
                console.log(`[SCENE GENERATE] Found beat at index ${currentIndex}`);
                nextBeats = bible.beats.slice(currentIndex + 1, currentIndex + 4);
            }
        }

        const nextContext = nextBeats.length > 0
            ? nextBeats.map(b => `[BEAT ${b.id}] ${b.title}: ${b.description}`).join('\n')
            : "";

        if (nextContext) {
            console.log(`[SCENE GENERATE] ✅ Including ${nextBeats.length} upcoming beats as future context`);
            console.log(`[SCENE GENERATE] Next beats IDs: ${nextBeats.map(b => b.id).join(', ')}`);
        } else {
            console.log(`[SCENE GENERATE] ⚠️ No upcoming beats found - this may be the last beat`);
        }

        // 2. Check if scene exists (or maybe we want to regenerate?)
        let scene = await Scene.findOne({ projectId, beatId });

        // 2.1 Get existing content (from request body or from existing scene)
        const existingContent = req.body.existingContent || (scene ? scene.content : "") || "";

        // 2.2 Find chapter and get editorial analysis if exists
        let editorialAnalysis = "";
        if (chapter && chapter.analysis) {
            editorialAnalysis = chapter.analysis;
            console.log(`[SCENE GENERATE] Found editorial analysis for chapter ${chapter.chapterNumber}`);
        }

        // If 'params' are provided in body, use them. Otherwise, default to Bible data.
        // Merge optional `direction` (e.g. "Make it darker", "Focus on dialogue") into instructions.
        const baseInstructions = req.body.params?.instructions || "";
        const directionClause = direction && direction.trim()
            ? `CREATIVE DIRECTION FOR THIS SCENE: ${direction.trim()}`
            : "";
        const combinedInstructions = [directionClause, baseInstructions].filter(Boolean).join('\n');

        let generationContext = {
            beat: req.body.params?.beat || beat,
            characters: req.body.params?.characters || bible.characters,
            setting: req.body.params?.setting || bible.settings,
            style: project.style,
            instructions: combinedInstructions
        };

        // 3. Generate Content
        const isRevision = existingContent && existingContent.trim().length > 0;
        console.log(`${isRevision ? 'Regenerating (revision mode)' : 'Generating'} scene for Project ${project.name}, Beat ${beatId} (with ${previousScenes.length} previous summaries as context)...`);
        if (isRevision) {
            console.log(`[SCENE GENERATE] Existing content length: ${existingContent.length} chars`);
            console.log(`[SCENE GENERATE] Editorial analysis: ${editorialAnalysis ? 'YES' : 'NO'}`);
        }

        const tempBible = {
            ...bible.toObject(),
            characters: generationContext.characters,
            settings: generationContext.setting
        };

        const content = await aiService.generateScene(
            generationContext.beat,
            tempBible,
            generationContext.style,
            project.language,
            generationContext.instructions,
            previousContext,
            project.customStyle || "",
            existingContent,
            editorialAnalysis,
            nextContext,
            project,
            bookBrief
        );

        // 3.1 Generate Summary for the new content
        console.log(`Generating summary for the new scene prose in ${project.language}...`);
        const summary = await aiService.generateSceneSummary(content, project.language, project);

        if (!scene) {
            scene = new Scene({
                projectId,
                ...(chapterNumber !== undefined ? { chapterNumber } : {}),
                beatId,
                title: beat.title,
                status: 'pending'
            });
        } else {
            // Archiving old version before overwriting
            if (scene.content) {
                scene.versions.push({
                    content: scene.content,
                    summary: scene.summary,
                    generatedAt: scene.generatedAt,
                    params: scene.currentParams,
                    versionNumber: scene.versions.length + 1
                });
            }
        }

        // 4. Update Scene
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        scene.content = content;
        scene.summary = summary; // Save the new summary
        scene.status = 'draft';
        scene.generatedAt = Date.now();
        scene.wordCount = wordCount;
        if (chapterNumber !== undefined) {
            scene.chapterNumber = chapterNumber;
        }
        scene.currentParams = {
            ...(req.body.params || { beat, characters: bible.characters, setting: bible.settings }),
            ...(direction && direction.trim() ? { direction: direction.trim() } : {})
        };
        await scene.save();

        res.json(scene);

    } catch (error) {
        console.error("Scene Generation Error:", safeErrorForLog(error));
        res.status(500).json({ error: error.message });
    }
});

// POST /api/scenes/generate-chapter
// Generate all scenes for a specific chapter
router.post('/generate-chapter', async (req, res) => {
    try {
        const { projectId, chapterNumber } = req.body;

        // 1. Fetch Context
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });
        const bookBrief = await getBookBriefByProjectId(projectId);
        console.log('[CHAPTER GENERATE] BookBrief prompt context', {
            projectId,
            bookBriefExists: Boolean(bookBrief),
            configuredFieldCount: countConfiguredBookBriefFields(bookBrief)
        });

        const chapter = bible.chapters.find(c => c.chapterNumber === chapterNumber);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found in Bible' });

        // Get all beats from this chapter
        const chapterBeats = chapter.beats || [];
        if (chapterBeats.length === 0) {
            return res.status(400).json({ error: 'No beats found in this chapter' });
        }

        console.log(`Generating ${chapterBeats.length} scenes for Chapter ${chapterNumber} of Project ${project.name}...`);

        const generatedScenes = [];

        // Generate scenes sequentially to maintain context
        const chapterSceneHistory = [];

        // Pre-load existing summaries from scenes before this chapter
        const priorScenes = await Scene.find({
            projectId,
            beatId: { $lt: chapterBeats[0]?.id ?? 0 },
            summary: { $exists: true, $ne: '' }
        }).sort({ beatId: 1 });
        priorScenes.forEach(s => chapterSceneHistory.push({ beatId: s.beatId, title: s.title || '', summary: s.summary || '' }));

        for (let i = 0; i < chapterBeats.length; i++) {
            const beat = chapterBeats[i];
            try {
                // Build layered context from all scenes so far
                const previousContext = aiService.buildLayeredContext(chapterSceneHistory);

                // Get next beats for future context
                const nextBeats = chapterBeats.slice(i + 1, i + 4);
                const nextContext = nextBeats.length > 0
                    ? nextBeats.map(b => `[BEAT ${b.id}] ${b.title}: ${b.description}`).join('\n')
                    : "";

                console.log(`[CHAPTER GENERATE] Beat ${beat.id}: ${chapterSceneHistory.length} previous scenes, ${nextBeats.length} upcoming beats`);

                // Generate content
                const content = await aiService.generateScene(
                    beat,
                    bible,
                    project.style,
                    project.language,
                    "",
                    previousContext,
                    project.customStyle || "",
                    "",
                    "",
                    nextContext,
                    project,
                    bookBrief
                );

                // Generate summary
                const summary = await aiService.generateSceneSummary(content, project.language, project);

                // Find or create scene
                let scene = await Scene.findOne({ projectId, beatId: beat.id });

                if (!scene) {
                    scene = new Scene({
                        projectId,
                        chapterNumber: chapter.chapterNumber,
                        beatId: beat.id,
                        title: beat.title,
                        status: 'pending'
                    });
                } else {
                    // Archive old version
                    if (scene.content) {
                        scene.versions.push({
                            content: scene.content,
                            summary: scene.summary,
                            generatedAt: scene.generatedAt,
                            params: scene.currentParams,
                            versionNumber: scene.versions.length + 1
                        });
                    }
                }

                // Update scene
                scene.content = content;
                scene.summary = summary;
                scene.status = 'draft';
                scene.generatedAt = Date.now();
                scene.wordCount = content.split(/\s+/).filter(Boolean).length;
                scene.chapterNumber = chapter.chapterNumber;
                scene.currentParams = {
                    beat: beat,
                    characters: bible.characters,
                    setting: bible.settings
                };

                await scene.save();
                generatedScenes.push(scene);
                chapterSceneHistory.push({ beatId: beat.id, title: beat.title || '', summary });

                console.log(`✓ Generated scene for Beat ${beat.id}: ${beat.title}`);
            } catch (error) {
                console.error(`✗ Failed to generate scene for Beat ${beat.id}:`, safeErrorForLog(error));
                // Continue with next beat even if one fails
            }
        }

        res.json({ 
            success: true,
            count: generatedScenes.length,
            scenes: generatedScenes 
        });

    } catch (error) {
        console.error("Chapter Scene Generation Error:", safeErrorForLog(error));
        res.status(500).json({ error: error.message });
    }
});

// POST /api/scenes/prompt
// Return the assembled prompt that would be sent to the AI for a scene generation (preview)
router.post('/prompt', async (req, res) => {
    try {
        const { projectId, beatId } = req.body;

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const bible = await Bible.findOne({ projectId });
        if (!bible) return res.status(404).json({ error: 'Bible not found' });
        const bookBrief = await getBookBriefByProjectId(projectId);

        console.log(`[SCENE PROMPT] Looking for beatId: ${beatId} (type: ${typeof beatId})`);
        
        // Try to find beat in flat beats array first
        let beat = bible.beats?.find(b => String(b.id) === String(beatId));
        
        // If not found, search in chapters
        if (!beat && bible.chapters) {
            console.log(`[SCENE PROMPT] Beat not found in bible.beats, searching in chapters...`);
            for (const chapter of bible.chapters) {
                if (chapter.beats) {
                    beat = chapter.beats.find(b => String(b.id) === String(beatId));
                    if (beat) {
                        console.log(`[SCENE PROMPT] ✓ Found beat in chapter ${chapter.chapterNumber}`);
                        break;
                    }
                }
            }
        } else if (beat) {
            console.log(`[SCENE PROMPT] ✓ Found beat in bible.beats`);
        }
        
        if (!beat) {
            console.error(`[SCENE PROMPT] ✗ Beat ${beatId} not found`);
            return res.status(404).json({ error: 'Beat not found in Bible' });
        }

        // Fetch previous summaries for context
        const previousScenes = await Scene.find({
            projectId,
            beatId: { $lt: beatId },
            summary: { $exists: true, $ne: "" }
        }).sort({ beatId: -1 }).limit(3);

        const previousContext = previousScenes
            .reverse()
            .map(s => `[SCENE ${s.beatId} SUMMARY]: ${s.summary}`)
            .join('\n\n');

        // Fetch Next Beats (Future Context for narrative direction)
        let nextBeats = [];
        console.log(`[SCENE PROMPT] Searching for beats after beatId ${beatId}...`);
        
        if (bible.chapters) {
            // Find current chapter and get next beats
            for (const chapter of bible.chapters) {
                if (chapter.beats) {
                    const currentBeatIndex = chapter.beats.findIndex(b => String(b.id) === String(beatId));
                    if (currentBeatIndex !== -1) {
                        console.log(`[SCENE PROMPT] Found beat at index ${currentBeatIndex} in chapter ${chapter.chapterNumber}`);
                        // Get next 2-3 beats from current chapter
                        nextBeats = chapter.beats.slice(currentBeatIndex + 1, currentBeatIndex + 4);
                        console.log(`[SCENE PROMPT] Found ${nextBeats.length} beats in current chapter`);
                        // If we need more beats and there's a next chapter, add some from there
                        if (nextBeats.length < 3) {
                            const nextChapter = bible.chapters.find(c => c.chapterNumber === chapter.chapterNumber + 1);
                            if (nextChapter && nextChapter.beats) {
                                const additionalBeats = nextChapter.beats.slice(0, 3 - nextBeats.length);
                                console.log(`[SCENE PROMPT] Adding ${additionalBeats.length} beats from next chapter ${nextChapter.chapterNumber}`);
                                nextBeats = [...nextBeats, ...additionalBeats];
                            }
                        }
                        break;
                    }
                }
            }
        } else if (bible.beats) {
            // Fallback to flat beats array
            console.log(`[SCENE PROMPT] Using flat beats array`);
            const currentIndex = bible.beats.findIndex(b => String(b.id) === String(beatId));
            if (currentIndex !== -1) {
                nextBeats = bible.beats.slice(currentIndex + 1, currentIndex + 4);
            }
        }

        const nextContext = nextBeats.length > 0
            ? nextBeats.map(b => `[BEAT ${b.id}] ${b.title}: ${b.description}`).join('\n')
            : "";

        if (nextContext) {
            console.log(`[SCENE PROMPT] ✅ Including ${nextBeats.length} upcoming beats in preview`);
            console.log(`[SCENE PROMPT] Next beats IDs: ${nextBeats.map(b => b.id).join(', ')}`);
        } else {
            console.log(`[SCENE PROMPT] ⚠️ No upcoming beats found for preview`);
        }

        // Get existing scene for content
        const existingScene = await Scene.findOne({ projectId, beatId });
        const existingContent = req.body.existingContent || (existingScene ? existingScene.content : "") || "";

        // Find chapter and get editorial analysis if exists
        let editorialAnalysis = "";
        if (bible.chapters) {
            const chapter = bible.chapters.find(c => c.beats && c.beats.some(b => String(b.id) === String(beatId)));
            if (chapter && chapter.analysis) {
                editorialAnalysis = chapter.analysis;
            }
        }

        // Build generation context (use provided params or defaults)
        const generationContext = {
            beat: req.body.params?.beat || beat,
            characters: req.body.params?.characters || bible.characters,
            setting: req.body.params?.setting || bible.settings,
            style: project.style,
            instructions: req.body.params?.instructions || ""
        };

        const tempBible = {
            ...bible.toObject(),
            characters: generationContext.characters,
            settings: generationContext.setting,
            // include project customStyle on the bible object so helper can read it
            customStyle: project.customStyle || ""
        };

        const prompt = await aiService.buildScenePrompt(
            generationContext.beat,
            tempBible,
            generationContext.style,
            project.language,
            generationContext.instructions,
            previousContext,
            project.customStyle || "",
            existingContent,
            editorialAnalysis,
            nextContext,
            project,
            bookBrief
        );

        res.json({ prompt });
    } catch (error) {
        console.error('Prompt preview error:', safeErrorForLog(error));
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/scenes/:id
// Update a scene
router.put('/:id', async (req, res) => {
    try {
        const { content, status } = req.body;
        const scene = await Scene.findById(req.params.id);

        if (!scene) {
            return res.status(404).json({ error: 'Scene not found' });
        }

        if (content !== undefined) {
            scene.content = content;
            scene.wordCount = content.split(/\s+/).filter(Boolean).length;
        }
        if (status !== undefined) scene.status = status;

        await scene.save();
        res.json(scene);
    } catch (error) {
        console.error("Failed to update scene:", safeErrorForLog(error));
        res.status(500).json({ error: 'Failed to update scene' });
    }
});

module.exports = router;
